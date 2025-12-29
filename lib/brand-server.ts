// src/lib/brand-server.ts

import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const FALLBACK_BRAND = {
  titleText: "Hive",
  logoLightUrl: null as string | null,
  logoDarkUrl: null as string | null,
  faviconUrl: null as string | null,
  sidebarIconUrl: null as string | null,
};

function normalizeUrl(input: string | null | undefined): string | null {
  const url = (input ?? "").trim();
  if (!url) return null;

  // Keep base64/data URIs as-is
  if (url.startsWith("data:")) return url;

  // Absolute URL
  if (/^https?:\/\//i.test(url)) return url;

  // Ensure leading slash for local paths
  return url.startsWith("/") ? url : `/${url}`;
}

function getBareHostFromHeaders(h: Headers): string {
  // Prefer forwarded host in real deployments (reverse proxies)
  const forwarded = (h.get("x-forwarded-host") || "").toLowerCase().trim();
  const host = (forwarded || h.get("host") || "").toLowerCase().trim();
  return host.split(",")[0]?.split(":")[0] || "";
}

function isLocalHost(bareHost: string) {
  return (
    bareHost === "localhost" ||
    bareHost === "127.0.0.1" ||
    bareHost === "::1"
  );
}

/**
 * Cached per request in RSC. Safe: no cross-user leakage.
 */
export const getBrandForRequest = cache(async () => {
  const h = headers();
  const bareHost = getBareHostFromHeaders(h);

  // Resolve tenantId
  let tenantId: string | null = null;

  if (!bareHost || isLocalHost(bareHost)) {
    const central = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    tenantId = central?.id ?? null;
  } else {
    const domain = await prisma.tenantDomain.findFirst({
      where: { domain: bareHost },
      select: { tenantId: true },
    });
    tenantId = domain?.tenantId ?? null;
  }

  // Fetch brand (tenant first, then central)
  const brand =
    (await prisma.brandSettings.findFirst({
      where: { tenantId },
      select: {
        titleText: true,
        logoLightUrl: true,
        logoDarkUrl: true,
        faviconUrl: true,
        sidebarIconUrl: true,
      },
    })) ??
    (await prisma.brandSettings.findFirst({
      where: { tenantId: null },
      select: {
        titleText: true,
        logoLightUrl: true,
        logoDarkUrl: true,
        faviconUrl: true,
        sidebarIconUrl: true,
      },
    }));

  if (!brand) return FALLBACK_BRAND;

  return {
    titleText: brand.titleText ?? FALLBACK_BRAND.titleText,
    logoLightUrl: normalizeUrl(brand.logoLightUrl),
    logoDarkUrl: normalizeUrl(brand.logoDarkUrl),
    faviconUrl: normalizeUrl(brand.faviconUrl) ?? FALLBACK_BRAND.faviconUrl,
    sidebarIconUrl: normalizeUrl(brand.sidebarIconUrl),
  };
});
