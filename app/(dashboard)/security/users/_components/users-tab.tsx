"use client";

import * as React from "react";

import {
  UsersTabClient,
  type UserForClient,
  type RoleLite,
} from "./users-tab-client";

import type {
  CompanySettingsInfo,
  BrandingSettingsInfo,
} from "@/components/data-table";

import { bootstrapUsersTab } from "../users-actions";

type Props = {
  permissionsList: string[];
};

type BootstrapPayload = {
  users: UserForClient[];
  assignableRoles: RoleLite[];
  centralRoleMap: Record<string, string>;
  currentUserId: string;
  tenantId: string | null;
  tenantName: string | null;
  companySettings: CompanySettingsInfo | null;
  brandingSettings: BrandingSettingsInfo | null;
};

export function UsersTab({ permissionsList }: Props) {
  const [data, setData] = React.useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setError(null);
    const result = (await bootstrapUsersTab()) as BootstrapPayload;
    setData(result);
  }, []);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const result = (await bootstrapUsersTab()) as BootstrapPayload;
        if (!mounted) return;
        setData(result);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load users.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading users…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-sm text-destructive">
        {error ?? "Failed to load users."}
      </div>
    );
  }

  return (
    <UsersTabClient
      users={data.users}
      assignableRoles={data.assignableRoles}
      centralRoleMap={data.centralRoleMap}
      currentUserId={data.currentUserId}
      tenantId={data.tenantId}
      tenantName={data.tenantName}
      permissions={permissionsList}
      companySettings={data.companySettings ?? undefined}
      brandingSettings={data.brandingSettings ?? undefined}
      reloadUsers={reload} // ✅ NEW: live refetch after mutations
    />
  );
}
