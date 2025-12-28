"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  RolesTab,
  type RoleDto,
  type PermissionDto,
} from "./roles/_components/roles-tab";
import { UsersTab } from "./users/_components/users-tab";

type Props = {
  permissionsList?: string[];
  roles: RoleDto[];
  allPermissions: PermissionDto[];
  defaultTab?: "users" | "roles" | "permissions";
};

export function SecurityTabsClient({
  permissionsList = [],
  roles,
  allPermissions,
  defaultTab = "users",
}: Props) {
  const has = React.useCallback(
    (k: string) => permissionsList.includes(k),
    [permissionsList]
  );

  const hasAny = React.useCallback((keys: string[]) => keys.some(has), [has]);

  const canUsers = hasAny([
    "users.view",
    "manage_users",
    "manage_security",
    "view_security",
  ]);

  const canRoles = hasAny([
    "roles.view",
    "manage_roles",
    "manage_security",
    "view_security",
  ]);

  const canPerms = hasAny([
    "permissions.view",
    "manage_roles",
    "manage_security",
    "view_security",
  ]);

  const initial =
    defaultTab === "users" && canUsers
      ? "users"
      : defaultTab === "roles" && canRoles
      ? "roles"
      : defaultTab === "permissions" && canPerms
      ? "permissions"
      : canUsers
      ? "users"
      : canRoles
      ? "roles"
      : "permissions";

  return (
    <Tabs defaultValue={initial} className="space-y-4">
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
          <RolesTab
            roles={roles}
            allPermissions={allPermissions}
            permissionsList={permissionsList}
          />
        </TabsContent>
      )}

      {/* Permissions tab later */}
      {/* {canPerms && (
        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTab
            permissions={allPermissions}
            permissionsList={permissionsList}
          />
        </TabsContent>
      )} */}
    </Tabs>
  );
}
