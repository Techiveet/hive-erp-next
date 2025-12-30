// src/lib/brand-server.ts

import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type HeadersLike = { get(name: string): string | null };

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
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

function getBareHostFromHeaders(h: HeadersLike): string {
  const forwarded = (h.get("x-forwarded-host") || "").toLowerCase().trim();
  const host = (forwarded || h.get("host") || "").toLowerCase().trim();
  return host.split(",")[0]?.split(":")[0] || "";
}

function isLocalHost(bareHost: string) {
  return bareHost === "localhost" || bareHost === "127.0.0.1" || bareHost === "::1";
}

export const getBrandForRequest = cache(async () => {
  const h = await headers();
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

  const selectBranding = {
    titleText: true,
    logoLightUrl: true,
    logoDarkUrl: true,
    faviconUrl: true,
    sidebarIconUrl: true,
  } as const;

  // ✅ 1) tenant branding (only if tenantId is a string)
  const tenantBranding = tenantId
    ? await prisma.brandingSettings.findFirst({
        where: { tenantId }, // tenantId is string here ✅
        select: selectBranding,
      })
    : null;

  // ✅ 2) fallback branding (central/default)
  // Since tenantId is NOT nullable in your schema, we cannot do tenantId: null.
  // So we simply fetch the first available "global" record.
  // If you have a better flag (isDefault/scope), use that instead.
  const fallbackBranding =
    tenantBranding ??
    (await prisma.brandingSettings.findFirst({
      select: selectBranding,
    }));

  if (!fallbackBranding) return FALLBACK_BRAND;

  return {
    titleText: fallbackBranding.titleText ?? FALLBACK_BRAND.titleText,
    logoLightUrl: normalizeUrl(fallbackBranding.logoLightUrl),
    logoDarkUrl: normalizeUrl(fallbackBranding.logoDarkUrl),
    faviconUrl: normalizeUrl(fallbackBranding.faviconUrl) ?? FALLBACK_BRAND.faviconUrl,
    sidebarIconUrl: normalizeUrl(fallbackBranding.sidebarIconUrl),
  };
});
