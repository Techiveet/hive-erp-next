"use server";

import { RoleScope } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { roleSchema } from "@/lib/validations/security";

const CENTRAL_SLUG = "central-hive";
const CENTRAL_SUPER = "central_superadmin";
const PROTECTED_ROLES = [CENTRAL_SUPER];

async function getCentralTenantId(): Promise<string> {
  const t = await prisma.tenant.findUnique({
    where: { slug: CENTRAL_SLUG },
    select: { id: true },
  });
  if (!t?.id) throw new Error("CENTRAL_TENANT_NOT_FOUND");
  return t.id;
}

/**
 * ✅ Central admin = ACTIVE membership in central tenant + role.key === central_superadmin
 * (Because your system assigns roles via Membership.roleId)
 */
async function assertCentralAdmin() {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const centralId = await getCentralTenantId();

  const mem = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: centralId, userId: user.id } },
    select: {
      status: true,
      role: { select: { key: true } },
    },
  });

  const ok = mem?.status === "ACTIVE" && mem.role?.key === CENTRAL_SUPER;
  if (!ok) throw new Error("FORBIDDEN_CENTRAL");
}

/**
 * CENTRAL ONLY: Create/Update role + permissions
 * - tenantId is always null here
 * - scope is always CENTRAL
 */
export async function upsertRoleAction(rawData: unknown) {
  await assertCentralAdmin();

  const parsed = roleSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message ?? "Invalid input");
  }

  const input = parsed.data;
  const tenantId: null = null;
  const scope: RoleScope = RoleScope.CENTRAL;

  // 1. Prevent creating a new role with a protected key
  if (!input.id && PROTECTED_ROLES.includes(input.key)) {
    throw new Error("CANNOT_CREATE_PROTECTED_ROLE");
  }

  // 2. Check for duplicate keys (excluding the current role being updated)
  const existingKey = await prisma.role.findFirst({
    where: {
      tenantId,
      key: input.key,
      NOT: input.id ? { id: input.id } : undefined,
    },
    select: { id: true },
  });

  if (existingKey) {
    throw new Error("A role with this system key already exists in this workspace.");
  }

  // UPDATE LOGIC
  if (input.id) {
    const current = await prisma.role.findUnique({
      where: { id: input.id },
      select: { key: true },
    });

    if (!current) throw new Error("Role not found");

    // Prevent changing the key of a system role
    if (PROTECTED_ROLES.includes(current.key)) {
      if (input.key !== current.key) throw new Error("CANNOT_CHANGE_PROTECTED_KEY");
    }

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: input.id! },
        data: {
          name: input.name,
          key: input.key,
          scope,
          tenantId,
        },
      });

      // Sync permissions: Delete old, add new
      await tx.rolePermission.deleteMany({ where: { roleId: input.id! } });

      if (input.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: input.permissionIds.map((pid) => ({
            roleId: input.id!,
            permissionId: pid,
          })),
          skipDuplicates: true,
        });
      }
    });

    return { ok: true, mode: "updated" as const };
  }

  // CREATE LOGIC
  await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        name: input.name,
        key: input.key,
        scope,
        tenantId,
      },
      select: { id: true },
    });

    if (input.permissionIds.length) {
      await tx.rolePermission.createMany({
        data: input.permissionIds.map((pid) => ({
          roleId: role.id,
          permissionId: pid,
        })),
        skipDuplicates: true,
      });
    }
  });

  return { ok: true, mode: "created" as const };
}

export async function deleteRoleAction(id: string) {
  await assertCentralAdmin();

  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true, key: true, tenantId: true },
  });

  if (!role) throw new Error("NOT_FOUND");
  if (role.tenantId !== null) throw new Error("TENANT_ROLE_NOT_ALLOWED_HERE");

  if (PROTECTED_ROLES.includes(role.key)) {
    throw new Error("CANNOT_DELETE_PROTECTED_ROLE");
  }

  try {
    await prisma.role.delete({ where: { id } });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "P2003") throw new Error("ROLE_IN_USE");
    throw e;
  }
}
