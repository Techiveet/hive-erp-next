// app/(dashboard)/security/page.tsx

import { SecurityTabsClient } from "./security-tabs-client";
import { bootstrapRolesTab } from "./roles/roles-actions";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type TabKey = "users" | "roles" | "permissions";

function safeTab(v: unknown): TabKey | null {
  if (v === "users" || v === "roles" || v === "permissions") return v;
  return null;
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SecurityPage({ searchParams }: PageProps) {
  const { user } = await getCurrentSession();
  if (!user?.id) redirect("/sign-in");

  const permissionsList = await getCurrentUserPermissions(null);

  const canEnter = permissionsList.includes("view_security") || permissionsList.includes("manage_security");
  if (!canEnter) redirect("/");

  const sp = (await searchParams) ?? {};
  const requestedTab = safeTab(Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "users";

  const canRoles =
    permissionsList.includes("roles.view") ||
    permissionsList.includes("manage_roles") ||
    permissionsList.includes("manage_security") ||
    permissionsList.includes("view_security");

  let rolesBootstrap: Awaited<ReturnType<typeof bootstrapRolesTab>> | undefined;

  if (canRoles) {
    try {
      rolesBootstrap = await bootstrapRolesTab();
    } catch {
      rolesBootstrap = undefined;
    }
  }

  // ✅ REQUIRED props for UsersTab
  const currentUserId = user.id;

  // ✅ until you wire a real tenant/workspace resolver, keep build-safe fallbacks
  const tenantId = (user as any)?.tenantId ?? "central";
  const tenantName = (user as any)?.tenantName ?? "Central";

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Security & Access
        </h1>
      </div>

      <SecurityTabsClient
        tenantId={tenantId}
        tenantName={tenantName}
        currentUserId={currentUserId}
        permissionsList={permissionsList}
        defaultTab={requestedTab}
        rolesBootstrap={rolesBootstrap}
      />
    </div>
  );
}
