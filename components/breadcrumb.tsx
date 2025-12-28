// components/breadcrumb.tsx
"use client";

import * as React from "react";

import { ChevronRight, Home } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type BreadcrumbItem = {
  label: React.ReactNode;
  href?: string; // if omitted => current page (no link)
};

type BreadcrumbProps = {
  /**
   * If provided, we render exactly these items (no auto generation).
   * If omitted, items are generated from the current pathname.
   */
  items?: BreadcrumbItem[];

  /** Show Home at the start */
  includeHome?: boolean;

  /** Home destination */
  homeHref?: string;

  /** Optional styling */
  className?: string;

  /**
   * Optional: segments to hide when auto-generating.
   * Example: ["dashboard"] so breadcrumbs start from your first module.
   */
  hideSegments?: string[];
};

/** "user-profile" -> "User Profile" */
function toTitle(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function Breadcrumb({
  items,
  includeHome = true,
  homeHref = "/dashboard",
  className,
  hideSegments = ["dashboard"], // ✅ new dashboard layout default
}: BreadcrumbProps) {
  const pathname = usePathname();

  const autoItems = React.useMemo<BreadcrumbItem[]>(() => {
    if (items?.length) return items;

    const cleanPath = pathname.split("?")[0];

    // remove empty and hidden segments
    const segments = cleanPath
      .split("/")
      .filter(Boolean)
      .filter((s) => !hideSegments.includes(s));

    // nothing to show if you’re on /dashboard (or hidden-only)
    if (!segments.length) return [];

    const crumbs: BreadcrumbItem[] = [];

    segments.forEach((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");

      crumbs.push({
        label: toTitle(segment),
        // last segment => current page (no link)
        href: index === segments.length - 1 ? undefined : href,
      });
    });

    return crumbs;
  }, [items, pathname, hideSegments]);

  const finalItems = autoItems;

  if (!includeHome && finalItems.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cx("flex items-center", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {includeHome && (
          <li className="inline-flex items-center">
            <Link
              href={homeHref}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium hover:bg-accent hover:text-foreground"
            >
              <Home className="h-3 w-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            {finalItems.length > 0 && (
              <ChevronRight className="ml-1 h-3 w-3 text-muted-foreground/70" />
            )}
          </li>
        )}

        {finalItems.map((item, index) => {
          const isLast = index === finalItems.length - 1;

          return (
            <li key={`${index}-${String(item.href ?? "current")}`} className="inline-flex items-center">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/70" />
              )}

              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="inline-flex items-center rounded-full bg-accent/60 px-2 py-1 text-[11px] font-semibold text-foreground"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
