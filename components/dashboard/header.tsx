// components/dashboard/header.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Command } from "lucide-react";
import Link from "next/link";
import { MobileSidebar } from "./mobile-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function DashboardHeader() {
  return (
    <header className="mb-4 flex items-center justify-between lg:hidden">
      <div className="flex items-center gap-2">
        <MobileSidebar />
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
            <Command className="h-5 w-5" />
          </div>
          <span className="text-base font-black tracking-tighter">Hive</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" className="rounded-full">
          Profile
        </Button>
      </div>
    </header>
  );
}
