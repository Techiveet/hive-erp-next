// lib/rbac-seed.ts

import { prisma } from "./prisma";

const CENTRAL_SLUG = "central-hive";
const CENTRAL_SUPER = "central_superadmin";

/**
 * Seed-safe central tenant resolver (no Next imports)
 */
async function getCentralTenantId(): Promise<string> {
  const central = await prisma.tenant.findUnique({
    where: { slug: CENTRAL_SLUG },
    select: { id: true },
  });

  if (!central?.id) throw new Error("CENTRAL_TENANT_NOT_FOUND");
  return central.id;
}

/**
 * Seed-safe: ensure central_superadmin has ALL permissions
 */
export async function syncCentralSuperAdminPermissionsSeed() {
  // make sure central exists (seed created it)
  await getCentralTenantId();

  // find central role (your design: tenantId null central role)
  const centralSuper = await prisma.role.findFirst({
    where: { key: CENTRAL_SUPER, tenantId: null },
    select: { id: true },
  });

  if (!centralSuper) {
    console.warn("[SEED RBAC] central_superadmin role not found – skipping sync");
    return;
  }

  const allPerms = await prisma.permission.findMany({
    select: { id: true },
  });

  const existing = await prisma.rolePermission.findMany({
    where: { roleId: centralSuper.id },
    select: { permissionId: true },
  });

  const existingSet = new Set(existing.map((rp) => rp.permissionId));

  const toCreate = allPerms
    .filter((p) => !existingSet.has(p.id))
    .map((p) => ({ roleId: centralSuper.id, permissionId: p.id }));

  if (!toCreate.length) {
    console.log("[SEED RBAC] central_superadmin already has all permissions");
    return;
  }

  await prisma.rolePermission.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  console.log(`[SEED RBAC] central_superadmin synced (${toCreate.length} added)`);
}
