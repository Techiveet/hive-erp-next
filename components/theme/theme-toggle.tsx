// components/theme/theme-toggle.tsx
"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop2, MoonStar, SunMedium } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

/**
 * Same glass class as topbar dropdowns (consistent UI)
 */
const GLASS_DROPDOWN =
  "rounded-2xl border p-1 backdrop-blur-2xl supports-[backdrop-filter]:backdrop-blur-2xl " +
  "bg-white/95 text-slate-900 border-slate-900/12 shadow-[0_22px_70px_rgba(2,6,23,0.16),0_2px_10px_rgba(2,6,23,0.10)] " +
  "dark:bg-slate-950/70 dark:text-slate-100 dark:border-white/10 dark:shadow-[0_28px_90px_rgba(0,0,0,0.62),0_2px_12px_rgba(0,0,0,0.32)]";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full bg-background/30 backdrop-blur"
        aria-label="Theme"
        title="Theme"
      >
        <Laptop2 className="h-4 w-4" />
      </Button>
    );
  }

  const Icon =
    resolvedTheme === "light"
      ? SunMedium
      : resolvedTheme === "dark"
      ? MoonStar
      : Laptop2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full bg-background/30 backdrop-blur"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className={`min-w-[160px] ${GLASS_DROPDOWN}`}>
        <DropdownMenuItem
          className="rounded-xl text-slate-900 dark:text-slate-100"
          onClick={() => setTheme("light")}
        >
          <SunMedium className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>

        <DropdownMenuItem
          className="rounded-xl text-slate-900 dark:text-slate-100"
          onClick={() => setTheme("dark")}
        >
          <MoonStar className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>

        <DropdownMenuItem
          className="rounded-xl text-slate-900 dark:text-slate-100"
          onClick={() => setTheme("system")}
        >
          <Laptop2 className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
