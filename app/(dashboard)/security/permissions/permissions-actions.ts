// app/(dashboard)/security/permissions/permissions-actions.ts
"use server";

import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** Match your server policy */
const SYSTEM_PERMISSION_KEYS = new Set([
  "manage_tenants",
  "manage_billing",
  "manage_security",
  "manage_roles",
  "view_security",
  "root",
]);

function isSystemPermissionKey(key: string) {
  return key.startsWith("sys_") || SYSTEM_PERMISSION_KEYS.has(key);
}

async function assertCan(required: string[]) {
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

export type PermissionsQuery = {
  page: number;
  pageSize: number;
  sortCol?: "name" | "key";
  sortDir?: "asc" | "desc";
  search?: string;
};

export type PermissionForClient = {
  id: string;
  name: string;
  key: string;
  isGlobal: boolean; // derived
};

export async function fetchPermissionsTabAction(q: Partial<PermissionsQuery>) {
  await assertCan(["permissions.view"]);

  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(q.pageSize ?? 10)));
  const skip = (page - 1) * pageSize;

const sortCol: "name" | "key" = q.sortCol === "key" ? "key" : "name";
const sortDir: "asc" | "desc" = q.sortDir === "desc" ? "desc" : "asc";

  const search = (q.search ?? "").trim();

  const where =
    search.length > 0
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { key: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

  const [totalEntries, items] = await Promise.all([
    prisma.permission.count({ where }),
    prisma.permission.findMany({
      where,
      orderBy: { [sortCol]: sortDir },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        key: true,
      },
    }),
  ]);

  const permissions: PermissionForClient[] = items.map((p) => ({
    ...p,
    isGlobal: isSystemPermissionKey(p.key),
  }));

  return { ok: true as const, totalEntries, permissions };
}

/**
 * ✅ Create/Update
 * - Blocks reserved/system keys
 */
export async function upsertPermissionAction(rawData: unknown) {
  const input = rawData as { id?: string | null; name: string; key: string };

  await assertCan([input.id ? "permissions.update" : "permissions.create"]);

  const key = (input.key ?? "").trim();
  const name = (input.name ?? "").trim();

  if (!key || !name) throw new Error("Invalid input");

  // ✅ reserved keys
  if (isSystemPermissionKey(key)) {
    throw new Error("KEY_RESERVED_FOR_SYSTEM");
  }

  const existing = await prisma.permission.findFirst({
    where: {
      key,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
    select: { id: true },
  });

  if (existing) throw new Error("PERMISSION_KEY_IN_USE");

  if (input.id) {
    await prisma.permission.update({
      where: { id: input.id },
      data: { name, key },
    });

    return { ok: true, mode: "updated" as const };
  }

  await prisma.permission.create({
    data: { name, key },
  });

  return { ok: true, mode: "created" as const };
}

/**
 * ✅ Single OR Bulk delete
 * - Accepts: string | string[]
 * - Blocks delete if permission is in use by any role
 * - Blocks delete if it's system/global (derived)
 */
export async function deletePermissionAction(idOrIds: string | string[]) {
  await assertCan(["permissions.delete"]);

  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);

  if (uniqueIds.length === 0) return { ok: true, deleted: 0, blocked: 0, deletedIds: [] as string[] };

  // load keys to detect system perms
  const perms = await prisma.permission.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, key: true },
  });

  const keyById = new Map(perms.map((p) => [p.id, p.key]));

  // single delete: throw like before
  if (!Array.isArray(idOrIds)) {
    const id = uniqueIds[0];
    const key = keyById.get(id);

    if (!key) throw new Error("NOT_FOUND");
    if (isSystemPermissionKey(key)) throw new Error("CANNOT_DELETE_SYSTEM_PERMISSION");

    const inUse = await prisma.rolePermission.findFirst({
      where: { permissionId: id },
      select: { roleId: true },
    });

    if (inUse) throw new Error("PERMISSION_IN_USE");

    await prisma.permission.delete({ where: { id } });
    return { ok: true, deleted: 1, blocked: 0, deletedIds: [id] };
  }

  // bulk delete: best-effort
  let deleted = 0;
  let blocked = 0;
  const deletedIds: string[] = [];

  for (const id of uniqueIds) {
    const key = keyById.get(id);
    if (!key) {
      blocked++;
      continue;
    }

    if (isSystemPermissionKey(key)) {
      blocked++;
      continue;
    }

    const inUse = await prisma.rolePermission.findFirst({
      where: { permissionId: id },
      select: { roleId: true },
    });

    if (inUse) {
      blocked++;
      continue;
    }

    await prisma.permission.delete({ where: { id } });
    deleted++;
    deletedIds.push(id);
  }

  return { ok: true, deleted, blocked, deletedIds };
}
