// lib/rbac.ts

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const CENTRAL_SLUG = "central-hive";
const CENTRAL_SUPER = "central_superadmin";

// Optional bypass keys (lets you gate UI quickly)
const CENTRAL_ADMIN_BYPASS = ["manage_security", "manage_roles", "manage_users"] as const;

/**
 * Central tenant resolver (single source of truth)
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
 * Returns permission keys for the current user in a given tenant.
 *
 * IMPORTANT:
 * - Permission model has NO tenantId => don't filter permissions by tenantId
 * - Role uses rolePermissions (pivot), NOT "permissions"
 */
export async function getCurrentUserPermissions(
  tenantId: string | null
): Promise<string[]> {
  const { user } = await getCurrentSession();
  if (!user?.id) return [];

  const effectiveTenantId = tenantId ?? (await getCentralTenantId());

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, tenantId: effectiveTenantId, status: "ACTIVE" },
    select: {
      role: {
        select: {
          key: true,
          rolePermissions: {
            select: {
              permission: { select: { key: true } },
            },
          },
        },
      },
    },
  });

  const roleKeys = memberships
    .map((m) => m.role?.key)
    .filter(Boolean) as string[];

  const isCentralSuper = roleKeys.includes(CENTRAL_SUPER);

  // ✅ central_superadmin => all permissions + bypass
  if (isCentralSuper) {
    const all = await prisma.permission.findMany({
      select: { key: true },
      orderBy: { key: "asc" },
    });

    return Array.from(
      new Set([...all.map((p) => p.key), ...CENTRAL_ADMIN_BYPASS])
    );
  }

  // ✅ normal user => rolePermissions
  const keys: string[] = [];
  for (const m of memberships) {
    const rps = m.role?.rolePermissions ?? [];
    for (const rp of rps) keys.push(rp.permission.key);
  }

  // If you want bypass keys ALWAYS present, just append them.
  // If you want them only when explicitly granted, keep filtering.
  const allowedBypass = CENTRAL_ADMIN_BYPASS.filter((k) => keys.includes(k));

  return Array.from(new Set([...keys, ...allowedBypass]));
}
