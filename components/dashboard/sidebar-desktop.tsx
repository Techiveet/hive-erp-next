// components/dashboard/sidebar-desktop.tsx
"use client";

import { Command, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DASHBOARD_NAV, DASHBOARD_SECONDARY } from "./nav";
import React, { useMemo } from "react";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { usePathname } from "next/navigation";

export function DashboardSidebarDesktop({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const widthClass = collapsed ? "w-[92px]" : "w-[280px]";

  return (
    <aside className={`mr-4 hidden shrink-0 lg:block ${widthClass}`}>
      <div className="glass-panel sticky top-6 rounded-[2rem] p-3">
        <SidebarInner collapsed={collapsed} onToggle={onToggle} />
      </div>
    </aside>
  );
}

function SidebarInner({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  const brand = useMemo(() => {
    return (
      <div className="mb-2">
        {/* Brand row */}
        <div
          className={[
            "relative flex items-center gap-3 px-1 py-1",
            collapsed ? "justify-center" : "justify-between",
          ].join(" ")}
        >
          <Link
            href="/dashboard"
            className={[
              "group flex items-center gap-3",
              collapsed ? "justify-center" : "",
            ].join(" ")}
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background transition-transform group-hover:scale-110">
              <Command className="h-6 w-6" />
              <div className="absolute inset-0 rounded-xl bg-brand-primary/20 blur-lg opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {!collapsed && (
              <div className="leading-tight">
                <div className="text-base font-black tracking-tighter">Hive</div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Control Hub
                </div>
              </div>
            )}
          </Link>

          {/* Toggle (expanded only) */}
          {!collapsed && (
            <Button
              variant="ghost"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="h-9 w-9 rounded-xl p-0 hover:bg-foreground/5"
            >
              <PanelLeftClose className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Toggle (collapsed mode) — centered + premium */}
        {collapsed && (
          <div className="mt-2 flex justify-center">
            <Button
              variant="ghost"
              onClick={onToggle}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className={[
                "h-10 w-10 rounded-2xl p-0",
                "border border-border/40 bg-background/25",
                "backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl",
                "shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
                "hover:bg-foreground/5",
              ].join(" ")}
            >
              <PanelLeftOpen className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    );
  }, [collapsed, onToggle]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {brand}

      {/* Nav */}
      <nav className="mt-3 flex-1 space-y-1">
        {DASHBOARD_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                collapsed ? "justify-center px-0" : "",
                active
                  ? "bg-brand-primary/12 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              ].join(" ")}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
        {DASHBOARD_SECONDARY.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
                collapsed ? "justify-center px-0" : "",
              ].join(" ")}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && item.label}
            </Link>
          );
        })}

        <Button
          variant="ghost"
          className={[
            "w-full rounded-2xl py-2 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            collapsed ? "justify-center px-0" : "justify-start px-3",
          ].join(" ")}
          title={collapsed ? "Logout" : undefined}
          onClick={async () => {
            try {
              await authClient.signOut();
            } finally {
              window.location.href = "/sign-in";
            }
          }}
        >
          <LogOut className={collapsed ? "h-4 w-4" : "mr-3 h-4 w-4"} />
          {!collapsed && "Logout"}
        </Button>

        <div
          className={[
            "flex items-center rounded-2xl border border-border/40 bg-background/30 px-3 py-2",
            collapsed ? "justify-center" : "justify-between",
          ].join(" ")}
        >
          {!collapsed && <div className="text-xs text-muted-foreground">Theme</div>}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
