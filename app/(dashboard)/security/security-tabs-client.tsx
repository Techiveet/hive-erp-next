// app/(dashboard)/security/security-tabs-client.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { UsersTab } from "./users/_components/users-tab";
import { RolesTabClient } from "./roles/_components/roles-tab-client";
import {
  PermissionsTabClient,
  type PermissionWithFlag,
} from "./permissions/_components/permissions-tab-client";

import type { RolesTabPayload } from "./roles/roles-actions";
import type { CompanySettingsInfo, BrandingSettingsInfo } from "@/components/datatable/data-table";

type TabKey = "users" | "roles" | "permissions";

type Props = {
  tenantId: string | null;
  tenantName: string | null;
  currentUserId: string;

  permissionsList?: string[];
  defaultTab?: TabKey;

  rolesBootstrap?: RolesTabPayload;

  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

function safeTab(v: string | null): TabKey | null {
  if (v === "users" || v === "roles" || v === "permissions") return v;
  return null;
}

export function SecurityTabsClient({
  tenantId,
  tenantName,
  currentUserId,
  permissionsList = [],
  defaultTab = "users",
  rolesBootstrap,
  companySettings,
  brandingSettings,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const has = React.useCallback((k: string) => permissionsList.includes(k), [permissionsList]);
  const hasAny = React.useCallback((keys: string[]) => keys.some((k) => has(k)), [has]);

  const canUsers = hasAny(["users.view", "manage_users", "manage_security", "view_security"]);
  const canRoles = hasAny(["roles.view", "manage_roles", "manage_security", "view_security"]);
  const canPerms = hasAny(["permissions.view", "manage_roles", "manage_security", "view_security"]);

  const firstAllowed: TabKey =
    (canUsers && "users") || (canRoles && "roles") || (canPerms && "permissions") || defaultTab;

  const urlTab = safeTab(sp.get("tab"));
  const activeFromUrl: TabKey =
    (urlTab === "users" && canUsers) ||
    (urlTab === "roles" && canRoles) ||
    (urlTab === "permissions" && canPerms)
      ? (urlTab as TabKey)
      : firstAllowed;

  const [value, setValue] = React.useState<TabKey>(activeFromUrl);

  React.useEffect(() => {
    setValue(activeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const onTabChange = (next: string) => {
    const tab = safeTab(next);
    if (!tab) return;

    if (tab === "users" && !canUsers) return;
    if (tab === "roles" && !canRoles) return;
    if (tab === "permissions" && !canPerms) return;

    setValue(tab);

    const params = new URLSearchParams(sp.toString());
    params.set("tab", tab);
    router.replace(`/security?${params.toString()}`);
  };

  const SYSTEM_PERMISSION_KEYS = new Set([
    "manage_tenants",
    "manage_billing",
    "manage_security",
    "manage_roles",
    "view_security",
    "root",
  ]);

  const allPerms = rolesBootstrap?.allPermissions ?? [];

  const permissionsForClient: PermissionWithFlag[] = React.useMemo(() => {
    return allPerms.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      isGlobal: p.key.startsWith("sys_") || SYSTEM_PERMISSION_KEYS.has(p.key),
    }));
  }, [allPerms]);

  return (
    <Tabs value={value} onValueChange={onTabChange} className="space-y-4">
      <TabsList>
        {canUsers && <TabsTrigger value="users">Users</TabsTrigger>}
        {canRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
        {canPerms && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
      </TabsList>

      {canUsers && (
        <TabsContent value="users" className="space-y-4">
          <UsersTab
            tenantId={tenantId}
            tenantName={tenantName}
            currentUserId={currentUserId}
            permissionsList={permissionsList}
            companySettings={companySettings ?? undefined}
            brandingSettings={brandingSettings ?? undefined}
          />
        </TabsContent>
      )}

      {canRoles && (
        <TabsContent value="roles" className="space-y-4">
          {rolesBootstrap ? (
            <RolesTabClient
              roles={rolesBootstrap.roles}
              totalEntries={rolesBootstrap.totalEntries}
              allPermissions={rolesBootstrap.allPermissions}
              permissions={permissionsList}
              companySettings={companySettings ?? undefined}
              brandingSettings={brandingSettings ?? undefined}
            />
          ) : (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              Roles data not loaded (missing rolesBootstrap).
            </div>
          )}
        </TabsContent>
      )}

      {canPerms && (
        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTabClient
            permissions={permissionsForClient}
            totalEntries={permissionsForClient.length}
            permissionsList={permissionsList}
            companySettings={companySettings ?? undefined}
            brandingSettings={brandingSettings ?? undefined}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
