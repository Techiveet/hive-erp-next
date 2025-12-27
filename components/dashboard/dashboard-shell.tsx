// components/dashboard/dashboard-shell.tsx
"use client";

import React, { useEffect, useState } from "react";

import { DashboardFooter } from "./footer";
import { DashboardSidebarDesktop } from "./sidebar-desktop";
import { DashboardTopbar } from "./topbar";
import type { ReactNode } from "react";

const SIDEBAR_KEY = "hive_sidebar_collapsed";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // ✅ Load persisted sidebar state
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_KEY);
      setCollapsed(raw === "1");
    } catch {
      // ignore (privacy mode, etc.)
    }
  }, []);

  // ✅ Toggle + persist
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="hive-noise relative min-h-screen overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 hive-mesh-bg" />
        <div className="absolute inset-0 hive-grid-mask" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hive-pointer-glow"
        />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-none px-3 py-3 md:px-6 md:py-6">
        {/* Desktop Sidebar */}
        <DashboardSidebarDesktop collapsed={collapsed} onToggle={toggleCollapsed} />

        {/* Main Column (✅ sticky footer via flex) */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* ✅ Sticky Topbar (topbar itself is sticky) */}
          <DashboardTopbar />

          {/* Content grows */}
          <main className="min-w-0 flex-1">
            <div className="glass-panel rounded-[2rem] p-4 shadow-[0_0_120px_-55px_rgba(0,0,0,0.65)] md:p-6">
              {children}
            </div>
          </main>

          {/* ✅ Sticky Footer (always pushed to bottom when content is short) */}
          <div className="mt-auto">
            <DashboardFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
