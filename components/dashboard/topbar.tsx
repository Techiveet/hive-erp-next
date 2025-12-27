// components/dashboard/topbar.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  Globe,
  Grid3X3,
  LogOut,
  Maximize2,
  Search,
  Settings,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { MobileSidebar } from "./mobile-sidebar";
import React from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { usePathname } from "next/navigation";

/**
 * ✅ Reusable glass dropdown style (works in light + dark)
 */
const GLASS_DROPDOWN =
  "rounded-2xl border p-1 backdrop-blur-2xl supports-[backdrop-filter]:backdrop-blur-2xl " +
  "bg-white/95 text-slate-900 border-slate-900/12 shadow-[0_22px_70px_rgba(2,6,23,0.16),0_2px_10px_rgba(2,6,23,0.10)] " +
  "dark:bg-slate-950/70 dark:text-slate-100 dark:border-white/10 dark:shadow-[0_28px_90px_rgba(0,0,0,0.62),0_2px_12px_rgba(0,0,0,0.32)]";

function crumbsFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return ["Home"];
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " "));
}

export function DashboardTopbar({
  brand = { title: "Hive", subtitle: "Enterprise Hub" },
}: {
  brand?: { title: string; subtitle?: string };
}) {
  const pathname = usePathname();
  const crumbs = crumbsFromPath(pathname);

  return (
    // ✅ 1) clip the sticky region so no rectangular blur shows
    <header className="sticky top-0 z-40 mb-4">
      {/* ✅ 2) this wrapper clips any blur/glow to rounded shape */}
      <div className="relative overflow-hidden rounded-[2rem]">
        {/* ✅ 3) keep ONLY gradient here (NO backdrop blur) */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/70 via-background/35 to-transparent" />

        {/* ✅ 4) apply blur to the actual bar, not the overlay rectangle */}
        <div className="glass-panel rounded-[2rem] px-4 py-3 backdrop-blur-2xl supports-[backdrop-filter]:backdrop-blur-2xl md:px-5">
          <div className="flex items-center justify-between gap-3">
            {/* LEFT */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <MobileSidebar />
              </div>

              {/* Search (desktop) */}
              <div className="hidden lg:flex lg:items-center">
                <div className="relative ml-2 w-[340px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="h-10 rounded-xl pl-9 bg-background/40"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-xl p-0 lg:hidden"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* Language */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 rounded-xl px-3">
                    <Globe className="mr-2 h-4 w-4" />
                    <span className="text-sm">EN</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className={`w-44 ${GLASS_DROPDOWN}`}>
                  <DropdownMenuLabel className="text-slate-700 dark:text-slate-300">
                    Language
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-black/10 dark:bg-white/10" />
                  <DropdownMenuItem className="rounded-xl text-slate-900 dark:text-slate-100">
                    EN
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl text-slate-900 dark:text-slate-100">
                    AM
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl text-slate-900 dark:text-slate-100">
                    FR
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="px-1">
                <ThemeToggle />
              </div>

              <Button
                variant="ghost"
                className="h-10 w-10 rounded-xl p-0"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </Button>

              <Button variant="ghost" className="h-10 w-10 rounded-xl p-0" aria-label="Apps">
                <Grid3X3 className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                className="hidden h-10 w-10 rounded-xl p-0 md:inline-flex"
                aria-label="Fullscreen"
                onClick={() => {
                  try {
                    if (!document.fullscreenElement)
                      document.documentElement.requestFullscreen();
                    else document.exitFullscreen();
                  } catch {}
                }}
              >
                <Maximize2 className="h-5 w-5" />
              </Button>

              {/* Account */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 rounded-xl px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" alt="User" />
                      <AvatarFallback>SA</AvatarFallback>
                    </Avatar>

                    <div className="ml-2 hidden text-left sm:block">
                      <div className="text-xs font-semibold leading-4">Super Admin</div>
                      <div className="text-[11px] text-muted-foreground leading-4">
                        Administrator
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className={`w-52 ${GLASS_DROPDOWN}`}>
                  <DropdownMenuLabel className="text-slate-700 dark:text-slate-300">
                    Account
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-black/10 dark:bg-white/10" />

                  <DropdownMenuItem className="rounded-xl text-slate-900 dark:text-slate-100">
                    <User className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>

                  <DropdownMenuItem className="rounded-xl text-slate-900 dark:text-slate-100">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-black/10 dark:bg-white/10" />

                  <DropdownMenuItem className="rounded-xl text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
