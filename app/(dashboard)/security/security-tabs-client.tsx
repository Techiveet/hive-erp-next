"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RolesTab, type RoleDto, type PermissionDto } from "./roles/_components/roles-tab";
import { UsersTab } from "./users/_components/users-tab";
import { PermissionsTab, type PermissionWithFlag } from "./permissions/_components/permissions-tab";

import type {
  CompanySettingsInfo,
  BrandingSettingsInfo,
} from "@/components/datatable/data-table";

type TabKey = "users" | "roles" | "permissions";

type Props = {
  permissionsList?: string[];
  roles: RoleDto[];
  allPermissions: PermissionDto[];
  defaultTab?: TabKey;

  // ✅ MUST be passed from the server page (or omitted entirely)
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

function safeTab(v: string | null): TabKey | null {
  if (v === "users" || v === "roles" || v === "permissions") return v;
  return null;
}

export function SecurityTabsClient({
  permissionsList = [],
  roles,
  allPermissions,
  defaultTab = "users",
  companySettings,       // ✅ now defined
  brandingSettings,      // ✅ now defined
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const has = React.useCallback(
    (k: string) => permissionsList.includes(k),
    [permissionsList]
  );

  const hasAny = React.useCallback((keys: string[]) => keys.some(has), [has]);

  const canUsers = hasAny(["users.view", "manage_users", "manage_security", "view_security"]);
  const canRoles = hasAny(["roles.view", "manage_roles", "manage_security", "view_security"]);
  const canPerms = hasAny(["permissions.view", "manage_roles", "manage_security", "view_security"]);

  const urlTab = safeTab(sp.get("tab"));

  const initial: TabKey =
    (urlTab === "users" && canUsers) ||
    (urlTab === "roles" && canRoles) ||
    (urlTab === "permissions" && canPerms)
      ? urlTab
      : defaultTab;

  const [value, setValue] = React.useState<TabKey>(initial);

  // back/forward sync
  React.useEffect(() => {
    setValue(initial);
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

  // ✅ map PermissionDto -> PermissionWithFlag for PermissionsTab
  const permissionsForClient: PermissionWithFlag[] = React.useMemo(
    () =>
      allPermissions.map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
        isGlobal: true, // change later if you add tenant/custom perms
      })),
    [allPermissions]
  );

  return (
    <Tabs value={value} onValueChange={onTabChange} className="space-y-4">
      <TabsList>
        {canUsers && <TabsTrigger value="users">Users</TabsTrigger>}
        {canRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
        {canPerms && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
      </TabsList>

      {canUsers && (
        <TabsContent value="users" className="space-y-4">
          <UsersTab permissionsList={permissionsList} />
        </TabsContent>
      )}

      {canRoles && (
        <TabsContent value="roles" className="space-y-4">
          <RolesTab roles={roles} allPermissions={allPermissions} permissionsList={permissionsList} />
        </TabsContent>
      )}

      {canPerms && (
        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTab
            permissions={permissionsForClient}
            permissionsList={permissionsList}
            companySettings={companySettings ?? undefined}
            brandingSettings={brandingSettings ?? undefined}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
