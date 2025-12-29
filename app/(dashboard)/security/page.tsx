import { RoleScope } from "@prisma/client";
import { SecurityTabsClient } from "./security-tabs-client";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type TabKey = "users" | "roles" | "permissions";
function safeTab(v: unknown): TabKey | null {
  if (v === "users" || v === "roles" || v === "permissions") return v;
  return null;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SecurityPage({ searchParams }: PageProps) {
  const { user } = await getCurrentSession();
  if (!user?.id) redirect("/sign-in");

  const permissionsList = await getCurrentUserPermissions(null);

  const canEnter =
    permissionsList.includes("view_security") ||
    permissionsList.includes("manage_security");

  if (!canEnter) redirect("/");

  // ✅ unwrap the Promise (Next.js 16.1 requirement)
  const sp = await searchParams;
  const requestedTab = safeTab(Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "users";

  // ✅ fetch central roles
  const roles = await prisma.role.findMany({
    where: { tenantId: null },
    orderBy: { createdAt: "asc" },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });

  const rolesForClient = roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    scope: r.scope as RoleScope,
    tenantId: null,
    permissions: r.rolePermissions.map((rp) => ({
      id: rp.permission.id,
      key: rp.permission.key,
      name: rp.permission.name,
    })),
  }));

  // ✅ fetch permissions (your schema has NO tenantId here)
  const allPermissions = await prisma.permission.findMany({
    orderBy: { key: "asc" },
  });

  const permsForClient = allPermissions.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }));

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Security & Access
        </h1>
      </div>

      <SecurityTabsClient
        permissionsList={permissionsList}
        roles={rolesForClient}
        allPermissions={permsForClient}
        defaultTab={requestedTab}
      />
    </div>
  );
}
