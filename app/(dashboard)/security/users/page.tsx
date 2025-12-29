import { Breadcrumb } from "@/components/breadcrumb";
import { UsersTab } from "./_components/users-tab";
import { bootstrapUsersTab } from "./users-actions";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function resolveTenantIdFromHost(): Promise<string | null> {
  const h = await headers(); 
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  if (bareHost === "localhost" || bareHost === "127.0.0.1") {
    const centralTenant = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    return centralTenant?.id ?? null;
  }

  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return domain?.tenantId ?? null;
}

export default async function UsersPage() {
  const { user } = await getCurrentSession();
  if (!user?.id) redirect("/sign-in");

  const tenantId = await resolveTenantIdFromHost();
  const permissionsList = await getCurrentUserPermissions(tenantId ?? null);

  const canManageUsers =
    permissionsList.includes("manage_users") ||
    permissionsList.includes("manage_security");

  if (!canManageUsers) redirect("/");

  // ✅ Fetch data on the server so router.refresh() works
  const bootstrapData = await bootstrapUsersTab();

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Users
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage users, roles and access permissions.
          </p>
        </div>
      </div>

      {/* ✅ Pass initialData from the server */}
      <UsersTab permissionsList={permissionsList} initialData={bootstrapData} />
    </div>
  );
}