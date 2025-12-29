"use server";

import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { permissionSchema } from "@/lib/validations/security";
import { prisma } from "@/lib/prisma";

const RESTRICTED_KEYS = ["manage_tenants", "manage_billing", "root"];

async function assertCanManagePermissions(required: string[]) {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const perms = await getCurrentUserPermissions(null);

  const ok = required.some(
    (k) =>
      perms.includes(k) ||
      perms.includes("manage_security") ||
      perms.includes("manage_roles") ||
      perms.includes("view_security")
  );

  if (!ok) throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
}

export async function upsertPermissionAction(rawData: unknown) {
  const result = permissionSchema.safeParse(rawData);
  if (!result.success) throw new Error(result.error.issues[0].message);

  const input = result.data;

  await assertCanManagePermissions(
    input.id ? ["permissions.update"] : ["permissions.create"]
  );

  // reserved keys
  if (RESTRICTED_KEYS.includes(input.key) || input.key.startsWith("sys_")) {
    throw new Error("KEY_RESERVED_FOR_SYSTEM");
  }

  // uniqueness (global)
  const existing = await prisma.permission.findFirst({
    where: {
      key: input.key,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
    select: { id: true },
  });

  if (existing) throw new Error("PERMISSION_KEY_IN_USE");

  if (input.id) {
    await prisma.permission.update({
      where: { id: input.id },
      data: { name: input.name, key: input.key },
    });
  } else {
    await prisma.permission.create({
      data: { name: input.name, key: input.key },
    });
  }

  return { ok: true };
}

export async function deletePermissionAction(id: string) {
  await assertCanManagePermissions(["permissions.delete"]);

  const perm = await prisma.permission.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!perm) throw new Error("NOT_FOUND");

  // ✅ Avoid COUNT() to dodge BIGINT count issues
  const inUse = await prisma.rolePermission.findFirst({
    where: { permissionId: id },
    select: { roleId: true },
  });

  if (inUse) throw new Error("PERMISSION_IN_USE");

  await prisma.permission.delete({ where: { id } });
  return { ok: true };
}
