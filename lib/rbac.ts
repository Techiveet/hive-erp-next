// lib/rbac.ts
// ✅ FIXED: no Permission.tenantId usage (because your DB doesn't have it)

import { prisma } from "./prisma";

/**
 * Ensure `central_superadmin` role always has *all* permissions.
 */
export async function syncCentralSuperAdminPermissions() {
  const centralRole = await prisma.role.findFirst({
    where: { key: "central_superadmin", tenantId: null },
  });

  if (!centralRole) {
    console.warn("[RBAC] central_superadmin role not found – nothing to sync.");
    return;
  }

  const allPermissions = await prisma.permission.findMany({
    select: { id: true },
  });

  if (!allPermissions.length) {
    console.warn("[RBAC] No permissions found – nothing to sync.");
    return;
  }

  await prisma.rolePermission.deleteMany({
    where: { roleId: centralRole.id },
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: centralRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  console.log(`[RBAC] Synced central_superadmin with ${allPermissions.length} permissions.`);
}
