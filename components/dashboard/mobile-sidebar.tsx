// components/dashboard/mobile-sidebar.tsx
"use client";

import { Command, Menu } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { DASHBOARD_NAV } from "./nav";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { usePathname } from "next/navigation";

export function MobileSidebar() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 rounded-full p-0" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[86vw] max-w-[340px] rounded-r-[2rem] border border-white/10 bg-background/90 p-4 shadow-2xl backdrop-blur-xl"
      >
        {/* ✅ Fix Radix warning */}
        <SheetHeader className="sr-only">
          <SheetTitle>Dashboard navigation</SheetTitle>
        </SheetHeader>

        <div className="glass-panel h-full rounded-[1.6rem] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
                <Command className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold">Navigation</div>
            </div>

            <SheetClose asChild>
              <Button variant="ghost" className="rounded-full text-xs">
                Close
              </Button>
            </SheetClose>
          </div>

          <Separator className="mb-3" />

          <ScrollArea className="h-[calc(100vh-210px)] pr-2">
            <nav className="space-y-1">
              {DASHBOARD_NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={[
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-brand-primary/12 text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
