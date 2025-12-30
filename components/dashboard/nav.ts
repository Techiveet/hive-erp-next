// components/dashboard/nav.ts

import {
  BarChart3,
  Boxes,
  Building2,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: any;
};

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tenants", href: "/dashboard/tenants", icon: Building2 },
  { label: "Security", href: "/security", icon: Users },
  { label: "Modules", href: "/dashboard/modules", icon: Boxes },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Audit Logs", href: "/dashboard/audit", icon: FileText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export const DASHBOARD_SECONDARY: NavItem[] = [
  { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
];
