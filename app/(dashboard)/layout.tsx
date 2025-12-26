// app/(dashboard)/layout.tsx

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

async function resolveTenant() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  if (bareHost === "localhost") {
    return prisma.tenant.findUnique({ where: { slug: "central-hive" } });
  }

  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  if (!domain?.tenantId) return null;

  return prisma.tenant.findUnique({ where: { id: domain.tenantId } });
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // ✅ protect all dashboard routes
  const h = await headers();
  const session = await auth.api.getSession({ headers: h as any });

  if (!session?.user?.email) {
    redirect("/sign-in");
  }

  const tenant = await resolveTenant();
  if (!tenant) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="font-semibold">{tenant.name}</div>
        <div className="text-sm opacity-80">{session.user.email}</div>
      </div>

      <main className="p-6">{children}</main>
    </div>
  );
}
