// src/lib/get-tenant-and-user.ts
// Production-ready: tenant resolution + auth + membership-based RBAC (matches your schema)

import { getCurrentSession } from "@/lib/auth-server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type GetTenantAndUserOptions = {
  redirectTo?: string;
  allowGuest?: boolean;
  /**
   * CENTRAL-only for now:
   * require user to be an ACTIVE member of the resolved tenant.
   */
  requireMembership?: boolean;
  devFallbackTenantSlug?: string;
};

type TenantAndUserResult = {
  user: { id: string } & Record<string, any>;
  tenant: any;
  host: string;
  membership: any | null;
  roleKey: string | null;
  isCentralSuperadmin: boolean;
};

function normalizeHost(rawHost: string): string {
  const h = (rawHost || "").trim().toLowerCase();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    const inside = end !== -1 ? h.slice(1, end) : h;
    return inside;
  }
  return h.split(",")[0].trim().split(":")[0];
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function resolveTenantByHost(host: string) {
  const td = await prisma.tenantDomain.findUnique({
    where: { domain: host },
    include: { tenant: true },
  });
  return td?.tenant ?? null;
}

async function resolveDevFallbackTenant(slug: string) {
  const bySlug = await prisma.tenant.findFirst({ where: { slug } });
  if (bySlug) return bySlug;
  return await prisma.tenant.findFirst();
}

export async function getTenantAndUser(
  options: GetTenantAndUserOptions = {}
): Promise<TenantAndUserResult | null> {
  const {
    redirectTo = "/",
    allowGuest = false,
    requireMembership = true,
    devFallbackTenantSlug = "central-hive",
  } = options;

  // 1) Auth
  const { user } = await getCurrentSession();

  if (!user?.id) {
    if (allowGuest) return null;
    redirect(`/sign-in?callbackURL=${encodeURIComponent(redirectTo)}`);
  }

  // 2) Host -> tenant
  const h = await headers();
  const host = normalizeHost(h.get("x-forwarded-host") || h.get("host") || "");

  let tenant = null;

  if (host && !isLocalHost(host)) {
    tenant = await resolveTenantByHost(host);
  }

  if (!tenant) {
    tenant = await resolveDevFallbackTenant(devFallbackTenantSlug);
  }

  if (!tenant) {
    throw new Error(
      "TENANT_RESOLUTION_FAILED: Seed at least one tenant (e.g. central-hive)."
    );
  }

  // 3) Membership (THIS matches your schema)
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    include: { role: true, tenant: true },
  });

  const roleKey = membership?.role?.key ?? null;
  const isCentralSuperadmin = roleKey === "central_superadmin";

  // 4) Membership guard (central-only behavior)
  if (requireMembership) {
    if (!membership) throw new Error("FORBIDDEN_TENANT_MEMBERSHIP_REQUIRED");
    if (membership.status !== "ACTIVE") throw new Error("FORBIDDEN_MEMBERSHIP_INACTIVE");
  }

  return {
    user,
    tenant,
    host,
    membership,
    roleKey,
    isCentralSuperadmin,
  };
}
