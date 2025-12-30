// app/(dashboard)/security/users/_components/users-tab.tsx
"use client";

import * as React from "react";
import { UsersTabClient, type RoleLite, type UserForClient } from "./users-tab-client";
import type { CompanySettingsInfo, BrandingSettingsInfo } from "@/components/datatable/data-table";
import { bootstrapUsersTab, type UsersTabPayload, type UsersTabQuery } from "../users-actions";

type Props = {
  permissionsList: string[];
  tenantId: string | null;
  tenantName: string | null;
  currentUserId: string;

  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

export function UsersTab({
  permissionsList,
  tenantId: tenantIdProp,
  tenantName: tenantNameProp,
  currentUserId,
  companySettings,
  brandingSettings,
}: Props) {
  const [users, setUsers] = React.useState<UserForClient[]>([]);
  const [totalEntries, setTotalEntries] = React.useState(0);
  const [assignableRoles, setAssignableRoles] = React.useState<RoleLite[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [effectiveTenantId, setEffectiveTenantId] = React.useState<string | null>(tenantIdProp);
  const [effectiveTenantName, setEffectiveTenantName] = React.useState<string | null>(tenantNameProp);
  const [contextScope, setContextScope] = React.useState<"CENTRAL" | "TENANT">("CENTRAL");

  const [query, setQuery] = React.useState<UsersTabQuery>({
    tenantId: tenantIdProp,
    page: 1,
    pageSize: 10,
    search: "",
    sortCol: "createdAt",
    sortDir: "desc",
  });

  const runBootstrap = React.useCallback(async (q: UsersTabQuery) => {
    setLoading(true);
    try {
      const res: UsersTabPayload = await bootstrapUsersTab({ ...q });

      setUsers(res.users);
      setTotalEntries(res.totalEntries);
      setAssignableRoles(res.assignableRoles ?? []);

      setContextScope(res.contextScope);
      setEffectiveTenantId(res.tenantId);
      setEffectiveTenantName(res.tenantName);

      setQuery((prev) => ({ ...prev, ...q }));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    runBootstrap(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantIdProp]);

  const onQueryChange = React.useCallback(
    async (updates: Partial<UsersTabQuery>) => {
      const next: UsersTabQuery = {
        ...query,
        ...updates,
        page: updates.search !== undefined || updates.pageSize !== undefined ? 1 : updates.page ?? query.page,
      };
      await runBootstrap(next);
    },
    [query, runBootstrap]
  );

  return (
    <div className="p-6">
      <UsersTabClient
        users={users}
        totalEntries={totalEntries}
        assignableRoles={assignableRoles}
        currentUserId={currentUserId}
        tenantId={effectiveTenantId}
        tenantName={effectiveTenantName}
        contextScope={contextScope}
        permissions={permissionsList}
        companySettings={companySettings ?? undefined}
        brandingSettings={brandingSettings ?? undefined}
        onQueryChangeFromParent={onQueryChange}
        loadingFromParent={loading}
      />
    </div>
  );
}
