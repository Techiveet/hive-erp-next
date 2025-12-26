// app/(dashboard)/page.tsx

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

async function resolveTenantId() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  if (bareHost === "localhost") {
    const t = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    return t?.id ?? null;
  }

  const d = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return d?.tenantId ?? null;
}

export default async function DashboardPage() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h as any });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const tenantId = await resolveTenantId();

  const membership = tenantId
    ? await prisma.membership.findFirst({
        where: { tenantId, userId: session.user.id },
        include: { role: true, tenant: true },
      })
    : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="rounded border p-4 space-y-2">
        <div>
          <span className="font-semibold">User:</span> {session.user.email}
        </div>
        <div>
          <span className="font-semibold">Tenant:</span> {membership?.tenant?.name ?? "Unknown"}
        </div>
        <div>
          <span className="font-semibold">Role:</span> {membership?.role?.name ?? "No role"}
        </div>
      </div>

      <div className="rounded border p-4">
        Next step: add modules (Users, Roles, Files, Inventory…)
      </div>
    </div>
  );
}
