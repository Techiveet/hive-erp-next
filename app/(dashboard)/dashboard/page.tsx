// app/(dashboard)/page.tsx

import { Badge } from "@/components/ui/badge";

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Tenant health, access control, and system telemetry in one place.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit rounded-full border-brand-primary/20 bg-brand-primary/10 text-brand-primary"
        >
          Core Kernel: Active
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8 rounded-[2rem] border border-border/50 bg-card/40 p-6">
          <div className="text-sm font-semibold">Realtime Activity</div>
          <div className="mt-2 h-40 rounded-[1.5rem] bg-muted/30" />
        </div>
        <div className="md:col-span-4 rounded-[2rem] border border-border/50 bg-card/40 p-6">
          <div className="text-sm font-semibold">Tenant Summary</div>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <Row k="Active tenants" v="128" />
            <Row k="Pending invites" v="14" />
            <Row k="Failed logins" v="3" />
          </div>
        </div>

        <div className="md:col-span-4 rounded-[2rem] border border-border/50 bg-card/40 p-6">
          <div className="text-sm font-semibold">RBAC</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Roles, permissions, and policy checks.
          </p>
        </div>

        <div className="md:col-span-4 rounded-[2rem] border border-border/50 bg-card/40 p-6">
          <div className="text-sm font-semibold">Audit Logs</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Track actions across tenants.
          </p>
        </div>

        <div className="md:col-span-4 rounded-[2rem] border border-border/50 bg-card/40 p-6">
          <div className="text-sm font-semibold">Storage</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Tenant-aware file systems.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{k}</span>
      <span className="font-semibold text-foreground">{v}</span>
    </div>
  );
}
