// app/(dashboard)/layout.tsx

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
