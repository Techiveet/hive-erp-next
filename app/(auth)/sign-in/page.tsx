import type { Metadata } from "next";
import { SignInClient } from "./sign-in-client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Sign In" };

async function getBrandSettings() {
  const h = await headers(); // ✅ Next.js 16: await is required
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  let tenantId: string | null = null;

  if (bareHost === "localhost") {
    const centralTenant = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    tenantId = centralTenant?.id ?? null;
  } else {
    const domain = await prisma.tenantDomain.findFirst({
      where: { domain: bareHost },
      select: { tenantId: true },
    });
    tenantId = domain?.tenantId ?? null;
  }

  if (!tenantId) return null;

  return prisma.brandSettings.findFirst({
    where: { tenantId },
    select: {
      titleText: true,
      logoLightUrl: true,
      logoDarkUrl: true,
      faviconUrl: true,
    },
  });
}

export default async function SignInPage() {
  const brand = await getBrandSettings();

  return (
    <SignInClient
      brand={{
        titleText: brand?.titleText ?? "Hive",
        logoLightUrl: brand?.logoLightUrl ?? null,
        logoDarkUrl: brand?.logoDarkUrl ?? null,
        faviconUrl: brand?.faviconUrl ?? null,
      }}
    />
  );
}
