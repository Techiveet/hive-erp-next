// app/(dashboard)/security/roles/roles-actions.ts
"use server";

import { MembershipStatus, Prisma, RoleScope } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { roleSchema } from "@/lib/validations/security";

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */

export type RolesTabQuery = {
  page?: number; // 1-indexed
  pageSize?: number;
  sortCol?: "name" | "key" | "createdAt" | "permissionsCount";
  sortDir?: "asc" | "desc";
  search?: string;
};

export type PermissionLite = { id: string; key: string; name: string };

export type RoleForClient = {
  id: string;
  key: string;
  name: string;
  scope: "CENTRAL" | "TENANT";
  tenantId: string | null;
  createdAt: string;
  permissionsCount: number;
};

export type RolesTabPayload = {
  roles: RoleForClient[];
  totalEntries: number;
  allPermissions: PermissionLite[];
};

/* ------------------------------------------------------------------
 * Central + auth helpers
 * ------------------------------------------------------------------ */

async function getCentralTenantId(): Promise<string> {
  const central = await prisma.tenant.findUnique({
    where: { slug: "central-hive" },
    select: { id: true },
  });
  if (!central) throw new Error("CENTRAL_TENANT_NOT_FOUND");
  return central.id;
}

async function authorizeRolesAction(requiredPermissions: string[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
    asResponse: false,
  });

  const actor = session?.user;
  if (!actor?.id) throw new Error("UNAUTHORIZED");

  const centralTenantId = await getCentralTenantId();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: centralTenantId, userId: actor.id } },
  });

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  const perms = await getCurrentUserPermissions(null);

  const hasRequired = requiredPermissions.some(
    (key) =>
      perms.includes(key) ||
      perms.includes("manage_security") ||
      perms.includes("manage_roles") ||
      perms.includes("manage_users")
  );

  if (!hasRequired) throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");

  return { actorId: actor.id, centralTenantId };
}

/* ------------------------------------------------------------------
 * ✅ Fetch Roles Tab (SERVER ACTION used by client for live refresh)
 * ------------------------------------------------------------------ */

export async function fetchRolesTabAction(query: RolesTabQuery = {}): Promise<RolesTabPayload> {
  await authorizeRolesAction(["roles.view", "manage_security"]);

  const page = Math.max(1, Number(query?.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(query?.pageSize ?? 10)));
  const skip = (page - 1) * pageSize;

  const search = String(query?.search ?? "").trim();
  const sortCol = (query?.sortCol ?? "createdAt") as RolesTabQuery["sortCol"];
  const sortDir = (query?.sortDir ?? "desc") as RolesTabQuery["sortDir"];

  const where = {
    tenantId: null as null,
    scope: RoleScope.CENTRAL,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { key: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sortCol === "name"
      ? [{ name: sortDir }, { id: "desc" as const }]
      : sortCol === "key"
        ? [{ key: sortDir }, { id: "desc" as const }]
        : [{ createdAt: sortDir }, { id: "desc" as const }];

  const [countResult, roles, allPermissions] = await Promise.all([
    prisma.$queryRaw<{ count: string }[]>`
      SELECT COUNT(*)::text as count
      FROM "role" r
      WHERE r."tenantId" IS NULL
        AND r."scope" = 'CENTRAL'
        ${
          search
            ? Prisma.sql`AND (r.name ILIKE ${"%" + search + "%"} OR r.key ILIKE ${"%" + search + "%"})`
            : Prisma.empty
        }
    `,
    prisma.role.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: orderBy as any,
      include: { _count: { select: { rolePermissions: true } } },
    }),
    prisma.permission.findMany({
      select: { id: true, key: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  let roleRows: RoleForClient[] = roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    scope: r.scope,
    tenantId: r.tenantId,
    createdAt: r.createdAt.toISOString(),
    permissionsCount: (r as any)._count?.rolePermissions ?? 0,
  }));

  if (sortCol === "permissionsCount") {
    roleRows = roleRows.sort((a, b) => {
      const diff = a.permissionsCount - b.permissionsCount;
      return sortDir === "asc" ? diff : -diff;
    });
  }

  return {
    roles: roleRows,
    totalEntries: parseInt(countResult?.[0]?.count ?? "0", 10),
    allPermissions,
  };
}

/* ------------------------------------------------------------------
 * Bootstrap (server page load convenience)
 * ------------------------------------------------------------------ */

export async function bootstrapRolesTab(query: RolesTabQuery = {}) {
  return fetchRolesTabAction(query);
}

// app/(dashboard)/security/roles/roles-actions.ts

/* ------------------------------------------------------------------
 * Create / Update Role (Optimized)
 * ------------------------------------------------------------------ */
export async function createOrUpdateRoleAction(rawData: unknown) {
  const parsed = roleSchema.safeParse(rawData);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "INVALID_INPUT");

  await authorizeRolesAction(["roles.create", "roles.update", "manage_security"]);
  const input = parsed.data;
  const tenantId = null;
  const scope = RoleScope.CENTRAL;

  // Use an increased timeout (15s) for operations involving complex joins
  return await prisma.$transaction(async (tx) => {
    if (input.id) {
      await tx.role.update({
        where: { id: input.id },
        data: { name: input.name, key: input.key, tenantId, scope },
      });

      // Clear and re-assign permissions
      await tx.rolePermission.deleteMany({ where: { roleId: input.id } });
      if (input.permissionIds?.length) {
        await tx.rolePermission.createMany({
          data: input.permissionIds.map((pid: string) => ({ roleId: input.id!, permissionId: pid })),
          skipDuplicates: true,
        });
      }
      return { ok: true, mode: "updated" };
    } else {
      const role = await tx.role.create({
        data: { name: input.name, key: input.key, tenantId, scope },
      });
      if (input.permissionIds?.length) {
        await tx.rolePermission.createMany({
          data: input.permissionIds.map((pid: string) => ({ roleId: role.id, permissionId: pid })),
          skipDuplicates: true,
        });
      }
      return { ok: true, mode: "created" };
    }
  }, {
    timeout: 15000 // 15 seconds
  });
}


/* ------------------------------------------------------------------
 * Delete Role(s) ✅ faster & consistent
 * ------------------------------------------------------------------ */

const PROTECTED_KEYS = ["central_superadmin"];

/* ------------------------------------------------------------------
 * Delete Role(s) (Optimized & Performant)
 * ------------------------------------------------------------------ */
export async function deleteRoleAction(input: { roleId: string } | { roleIds: string[] }) {
  await authorizeRolesAction(["roles.delete", "manage_security"]);

  const ids = "roleIds" in input ? input.roleIds : [input.roleId];
  if (!ids.length) return { ok: true, deleted: 0, blocked: 0, deletedIds: [] };

  const roles = await prisma.role.findMany({
    where: { id: { in: ids } },
    select: { id: true, key: true, tenantId: true, scope: true },
  });

  const deletableIds = roles
    .filter((r) => r.tenantId === null && r.scope === "CENTRAL" && !PROTECTED_KEYS.includes(r.key))
    .map((r) => r.id);

  let blocked = ids.length - deletableIds.length;
  if (!deletableIds.length) return { ok: true, deleted: 0, blocked, deletedIds: [] };

  try {
    return await prisma.$transaction(async (tx) => {
      // ✅ Step 1: Explicitly nullify references in Membership first.
      // Even with onDelete: SetNull, doing this explicitly in the same tx 
      // can be more stable for massive tables.
      await tx.membership.updateMany({
        where: { roleId: { in: deletableIds } },
        data: { roleId: null }
      });

      // ✅ Step 2: Delete Role. 
      // Join rows (RolePermission/UserRole) will be deleted by DB-level Cascades.
      const { count } = await tx.role.deleteMany({
        where: { id: { in: deletableIds } }
      });

      return { ok: true, deleted: count, blocked, deletedIds: deletableIds };
    }, {
      timeout: 30000 // Increase to 30s to handle the large Membership table update
    });
  } catch (e: any) {
    console.error("Role deletion failed:", e);
    throw new Error(e.message || "DATABASE_TRANSACTION_FAILED");
  }
}

export async function getRoleDetailsAction(input: { roleId: string }): Promise<{ permissionIds: string[] }> {
  await authorizeRolesAction(["roles.view", "manage_security"]);

  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { rolePermissions: { select: { permissionId: true } } },
  });

  if (!role) throw new Error("ROLE_NOT_FOUND");

  return { permissionIds: role.rolePermissions.map((rp) => rp.permissionId) };
}
