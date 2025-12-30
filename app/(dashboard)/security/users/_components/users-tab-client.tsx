// app/(dashboard)/security/users/_components/users-tab-client.tsx
"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Calendar,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Mail,
  Pencil,
  PlusCircle,
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { createOrUpdateUserAction, deleteUserAction, toggleUserActiveAction, fetchUsersTabAction } from "../users-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type CompanySettingsInfo, type BrandingSettingsInfo } from "@/components/datatable/data-table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export type RoleLite = {
  id: string;
  key: string;
  name: string;
  scope: "CENTRAL" | "TENANT";
};

export type UserForClient = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  isActive: boolean;
  avatarUrl?: string | null;
  userRoles: {
    id: string;
    roleId: string | null;
    role: { key: string; name: string; scope?: "CENTRAL" | "TENANT" };
    tenantId: string; // ✅ always string
  }[];
};

type Query = {
  page: number;
  pageSize: number;
  sortCol?: string;
  sortDir?: "asc" | "desc";
  search?: string;
};

type Props = {
  users: UserForClient[];
  totalEntries: number;
  assignableRoles?: RoleLite[];
  currentUserId: string;

  tenantId: string | null; // CENTRAL => null (UI)
  tenantName: string | null;

  contextScope: "CENTRAL" | "TENANT";

  permissions: string[];
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;

  onQueryChangeFromParent?: (updates: any) => void;
  loadingFromParent?: boolean;
};

function generateStrongPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function initials(name?: string | null, email?: string) {
  const src = (name || email || "").trim();
  if (!src) return "??";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src[0]!.toUpperCase();
}

const createdAtFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

function formatCreatedAt(dateStr: string) {
  try {
    return createdAtFormatter.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function UsersTabClient(props: Props) {
  const {
    users: initialUsers,
    totalEntries: initialTotal,
    assignableRoles = [],
    currentUserId,
    tenantId,
    tenantName,
    contextScope,
    permissions = [],
    companySettings,
    brandingSettings,
  } = props;

  const isCentralAdmin = contextScope === "CENTRAL";

  const [rows, setRows] = React.useState<UserForClient[]>(initialUsers);
  const [totalEntries, setTotalEntries] = React.useState<number>(initialTotal);
  const [loading, setLoading] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const has = (key: string) => permissions.includes(key);
  const canViewUsers = has("users.view") || has("manage_security");
  const canCreateUsers = has("users.create") || has("manage_security");
  const canUpdateUsers = has("users.update") || has("manage_security");
  const canDeleteUsers = has("users.delete") || has("manage_security");
  const canToggleUserActive = canUpdateUsers;

  const [query, setQuery] = React.useState<Query>({
    page: 1,
    pageSize: 10,
    sortCol: "createdAt",
    sortDir: "desc",
    search: "",
  });

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedRowsOnPage, setSelectedRowsOnPage] = React.useState<UserForClient[]>([]);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);

  const [bulkDeletableUsers, setBulkDeletableUsers] = React.useState<UserForClient[]>([]);
  const [editingUser, setEditingUser] = React.useState<UserForClient | null>(null);
  const [viewUser, setViewUser] = React.useState<UserForClient | null>(null);

  const [formName, setFormName] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formConfirmPassword, setFormConfirmPassword] = React.useState("");
  const [formRoleId, setFormRoleId] = React.useState<string>("");
  const [formAvatar, setFormAvatar] = React.useState<string | null>(null);

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const isEdit = !!editingUser;

  // ✅ FIX: roles dropdown strictly based on server contextScope
  const modalAssignableRoles = React.useMemo(() => {
    return assignableRoles.filter((r) => (isCentralAdmin ? r.scope === "CENTRAL" : r.scope === "TENANT"));
  }, [assignableRoles, isCentralAdmin]);

  const safeDefaultRoleId = React.useMemo(() => modalAssignableRoles[0]?.id ?? "", [modalAssignableRoles]);

  const isSuperadminEditing = React.useMemo(() => {
    if (!editingUser) return false;
    if (isCentralAdmin) return editingUser.userRoles.some((ur) => ur.role.key === "central_superadmin");
    return editingUser.userRoles.some((ur) => ur.role.key === "tenant_superadmin" && !!tenantId);
  }, [editingUser, isCentralAdmin, tenantId]);

  const isProtectedUser = React.useCallback(
    (u: UserForClient) => {
      const isSelf = u.id === currentUserId;
      const isCentralSuperadmin = u.userRoles.some((ur) => ur.role.key === "central_superadmin");
      const isTenantSuperadmin = !isCentralAdmin && u.userRoles.some((ur) => ur.role.key === "tenant_superadmin");
      return isSelf || isCentralSuperadmin || isTenantSuperadmin;
    },
    [currentUserId, isCentralAdmin]
  );

  function getPrimaryRoleName(u: UserForClient): string {
    if (isCentralAdmin) {
      const centralRole = u.userRoles.find((ur) => ur.role.scope === "CENTRAL" || ur.role.key.startsWith("central_"));
      return centralRole?.role.name ?? "Central User";
    }
    const tenantRole = u.userRoles.find((ur) => ur.role.scope === "TENANT" || ur.role.key.startsWith("tenant_"));
    return tenantRole?.role.name ?? "Member";
  }

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormConfirmPassword("");
    setFormRoleId(safeDefaultRoleId);
    setFormAvatar(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function openCreate() {
    if (!canCreateUsers) return;
    setEditingUser(null);
    resetForm();
    setCreateDialogOpen(true);
  }

  function openEdit(user: UserForClient) {
    if (!canUpdateUsers) return;

    setEditingUser(user);
    setFormName(user.name || "");
    setFormEmail(user.email);
    setFormAvatar(user.avatarUrl ?? null);

    const rolePick = isCentralAdmin
      ? user.userRoles.find((ur) => ur.role.key.startsWith("central_"))
      : user.userRoles.find((ur) => ur.role.key.startsWith("tenant_"));

    setFormRoleId(rolePick?.roleId ?? safeDefaultRoleId);

    if (isSuperadminEditing) {
      setFormPassword("********");
      setFormConfirmPassword("********");
    } else {
      setFormPassword("");
      setFormConfirmPassword("");
    }

    setCreateDialogOpen(true);
  }

  function openView(user: UserForClient) {
    if (!canViewUsers) return;
    setViewUser(user);
    setViewDialogOpen(true);
  }

  function handleGeneratePassword() {
    const pwd = generateStrongPassword();
    setFormPassword(pwd);
    setFormConfirmPassword(pwd);
    setShowPassword(true);
    setShowConfirmPassword(true);
  }

  function handlePickAvatar() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("open-file-manager", {
        detail: {
          filter: "images" as const,
          onSelect: (file: { url: string }) => setFormAvatar(file.url),
        },
      })
    );
  }

  async function refetch(nextQuery: Query) {
    setLoading(true);
    try {
      const payload = await fetchUsersTabAction({
        // ✅ CENTRAL context: don't pass null tenantId to memberships; server will use central tenant partition
        tenantId: undefined,
        page: nextQuery.page,
        pageSize: nextQuery.pageSize,
        sortCol: (nextQuery.sortCol as any) ?? "createdAt",
        sortDir: nextQuery.sortDir ?? "desc",
        search: nextQuery.search ?? "",
      });

      setRows(payload.users);
      setTotalEntries(payload.totalEntries);
    } finally {
      setLoading(false);
    }
  }

  async function runQuery(updates: Partial<Query>) {
    const next: Query = {
      ...query,
      ...updates,
      page:
        updates.search !== undefined ||
        updates.pageSize !== undefined ||
        updates.sortCol !== undefined ||
        updates.sortDir !== undefined
          ? 1
          : updates.page ?? query.page,
    };

    setQuery(next);
    setRowSelection({});
    setSelectedRowsOnPage([]);

    try {
      await refetch(next);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load users.");
    }
  }

  async function reloadCurrentQuery() {
    try {
      await refetch(query);
    } catch (e: any) {
      toast.error(e?.message || "Failed to reload users.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isEdit && !canUpdateUsers) return;
    if (!isEdit && !canCreateUsers) return;

    const skipPasswordChange = isEdit && isSuperadminEditing;

    if (!skipPasswordChange && formPassword && formPassword !== formConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!isEdit && !formPassword) {
      toast.error("Password is required for new users");
      return;
    }

    if (!isSuperadminEditing && !formRoleId) {
      toast.error("Please select a role");
      return;
    }

    const passwordToSend = skipPasswordChange ? null : formPassword || null;

    startTransition(async () => {
      try {
        await createOrUpdateUserAction({
          id: editingUser?.id ?? null,
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          password: passwordToSend,
          roleId: formRoleId,
          tenantId: isCentralAdmin ? null : tenantId, // server enforces anyway
          avatarUrl: formAvatar,
        });

        toast.success(isEdit ? "User updated successfully" : "User created");
        setCreateDialogOpen(false);
        await reloadCurrentQuery();
      } catch (err: any) {
        toast.error(err?.message || "Failed to save user.");
      }
    });
  }

  function handleBulkDeleteConfirm() {
    if (!canDeleteUsers) return;

    startTransition(async () => {
      try {
        if (!bulkDeletableUsers.length) {
          setBulkDialogOpen(false);
          return;
        }

        let errors = 0;
        await Promise.all(
          bulkDeletableUsers.map(async (u) => {
            try {
              await deleteUserAction({ userId: u.id });
            } catch {
              errors++;
            }
          })
        );

        if (errors > 0) toast.warning("Some users could not be deleted.");
        else toast.success("Selected users deleted.");

        setBulkDialogOpen(false);
        setBulkDeletableUsers([]);
        setRowSelection({});
        setSelectedRowsOnPage([]);
        await reloadCurrentQuery();
      } catch {
        toast.error("Failed to delete selected users.");
      }
    });
  }

  const columns = React.useMemo<ColumnDef<UserForClient>[]>(() => {
    return [
      {
        id: "name",
        accessorFn: (row) => `${row.name ?? ""} ${row.email}`,
        header: "User",
        cell: ({ row }) => {
          const u = row.original;
          const hasAvatar = !!u.avatarUrl;

          return (
            <div className="flex items-center gap-3">
              {hasAvatar ? (
                <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-primary/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.avatarUrl!} alt={u.name || u.email} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-2 ring-background">
                  {initials(u.name, u.email)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{u.name || "Unknown"}</span>
                <span className="text-xs text-muted-foreground">{u.email}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Role",
        accessorFn: (row) => getPrimaryRoleName(row),
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-muted/50 font-normal">
            {getPrimaryRoleName(row.original)}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
        cell: ({ row }) => {
          const u = row.original;
          const disabled = isProtectedUser(u) || isPending || !canToggleUserActive;

          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={u.isActive}
                disabled={disabled}
                onCheckedChange={() =>
                  startTransition(async () => {
                    try {
                      await toggleUserActiveAction({ userId: u.id, newActive: !u.isActive });
                      toast.success(`User ${!u.isActive ? "activated" : "deactivated"}`);
                      await reloadCurrentQuery();
                    } catch (err: any) {
                      const msg = err?.message || "";
                      if (msg.includes("CANNOT_DEACTIVATE_SELF")) toast.error("You cannot deactivate your own account.");
                      else if (msg.includes("FORBIDDEN_INSUFFICIENT_PERMISSIONS")) toast.error("No permission.");
                      else toast.error("Failed to update user status.");
                    }
                  })
                }
              />
              <span className={`text-xs font-medium ${u.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                {u.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          );
        },
      },
      {
        id: "createdAt",
        header: "Joined",
        accessorFn: (row) => formatCreatedAt(row.createdAt),
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatCreatedAt(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const u = row.original;
          const protectedUser = isProtectedUser(u);

          const viewDisabled = !canViewUsers;
          const editDisabled = !canUpdateUsers;
          const deleteDisabled = protectedUser || !canDeleteUsers;

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(u)}
                disabled={viewDisabled}
                title={viewDisabled ? "No permission" : "View Details"}
              >
                {viewDisabled ? <Lock className="h-3 w-3 opacity-70" /> : <Eye className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                onClick={() => openEdit(u)}
                disabled={editDisabled}
                title={editDisabled ? "No permission" : "Edit User"}
              >
                {editDisabled ? <Lock className="h-3 w-3 opacity-70" /> : <Pencil className="h-4 w-4" />}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    disabled={deleteDisabled}
                    title={deleteDisabled ? "No permission" : "Delete User"}
                  >
                    {deleteDisabled ? <Lock className="h-3 w-3 opacity-50" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete User?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <b>{u.email}</b>? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white"
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await deleteUserAction({ userId: u.id });
                            toast.success("User deleted");
                            await reloadCurrentQuery();
                          } catch (e: any) {
                            toast.error(e?.message || "Failed to delete user.");
                          }
                        })
                      }
                    >
                      Delete User
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
        meta: { exportable: false, printable: false, align: "right" },
      },
    ];
  }, [canDeleteUsers, canToggleUserActive, canUpdateUsers, canViewUsers, isPending, isProtectedUser]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 p-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{isCentralAdmin ? "System Users" : "Team Members"}</h2>
          <p className="text-sm text-muted-foreground">Manage access for {tenantName || "the platform"}.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setRowSelection({});
              setSelectedRowsOnPage([]);
              await reloadCurrentQuery();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>

          {canCreateUsers && (
            <Button onClick={openCreate} className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add User
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <DataTable<UserForClient, any>
          columns={columns}
          data={rows}
          fileName="users"
          serverMode
          totalEntries={totalEntries}
          loading={loading}
          searchColumnId="email"
          searchPlaceholder="Search by email..."
          pageIndex={query.page}
          pageSize={query.pageSize}
          onQueryChange={(q) => runQuery(q as Partial<Query>)}
          enableRowSelection
          selectedRowIds={rowSelection}
          onSelectionChange={({ selectedRowIds, selectedRowsOnPage }) => {
            setRowSelection(selectedRowIds);
            setSelectedRowsOnPage(selectedRowsOnPage as UserForClient[]);
          }}
          onDeleteRows={() => {
            if (!canDeleteUsers) {
              toast.error("No permission to delete.");
              return;
            }
            const deletable = selectedRowsOnPage.filter((u) => !isProtectedUser(u));
            setBulkDeletableUsers(deletable);
            setBulkDialogOpen(true);
          }}
          companySettings={companySettings ?? undefined}
          brandingSettings={brandingSettings ?? undefined}
        />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" />
              {isEdit ? "Edit User" : "Create User"}
            </DialogTitle>
            <DialogDescription>
              {isCentralAdmin ? "Assign central system role and credentials." : "Assign tenant role and credentials."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[220px,1fr]">
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 p-4">
                <div className="relative h-20 w-20">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-background shadow-sm">
                    {formAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={formAvatar} alt={formName || formEmail || "Avatar"} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-semibold text-primary">{initials(formName, formEmail)}</span>
                    )}
                  </div>
                  {formAvatar && (
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 rounded-full bg-background p-1 shadow"
                      onClick={() => setFormAvatar(null)}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2 text-center">
                  <p className="text-xs text-muted-foreground">Profile photo (optional)</p>
                  <Button type="button" size="sm" variant="outline" onClick={handlePickAvatar} className="justify-center">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Choose from File Manager
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Name</label>
                    <input className="w-full rounded border bg-background p-2 text-sm" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Email</label>
                    <input type="email" className="w-full rounded border bg-background p-2 text-sm" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required disabled={isEdit} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Role</label>
                  <select
                    className="w-full rounded border bg-background p-2 text-sm"
                    value={formRoleId}
                    onChange={(e) => setFormRoleId(e.target.value)}
                    required={!isSuperadminEditing}
                    disabled={isSuperadminEditing}
                  >
                    <option value="">Select {isCentralAdmin ? "system" : "tenant"} role...</option>

                    {modalAssignableRoles.length === 0 ? (
                      <option value="" disabled>
                        No {isCentralAdmin ? "system" : "tenant"} roles available. Please create roles first.
                      </option>
                    ) : (
                      modalAssignableRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))
                    )}
                  </select>

                  {isSuperadminEditing && <p className="mt-1 text-[11px] text-amber-600">Super administrator role cannot be changed.</p>}
                  {modalAssignableRoles.length === 0 && !isSuperadminEditing && (
                    <p className="mt-1 text-[11px] text-red-600">No roles available. Please create roles first.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Credentials</p>
                {!isSuperadminEditing && (
                  <Button type="button" variant="outline" size="sm" onClick={handleGeneratePassword}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Generate Password
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase text-muted-foreground">{isEdit ? "New Password" : "Password"}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded border bg-background p-2 pr-10 text-sm"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={isEdit ? "Leave blank to keep" : ""}
                      disabled={isSuperadminEditing && isEdit}
                      required={!isEdit}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isSuperadminEditing && isEdit}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full rounded border bg-background p-2 pr-10 text-sm"
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      disabled={isSuperadminEditing && isEdit}
                      required={!isEdit && formPassword.length > 0}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      disabled={isSuperadminEditing && isEdit}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {isSuperadminEditing && <p className="pt-1 text-[11px] text-amber-600">Super administrator password cannot be changed from this screen.</p>}
            </div>

            <div className="mt-2 flex justify-end gap-2 border-t pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || (!isSuperadminEditing && !formRoleId)}>
                {isEdit ? "Save Changes" : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-primary" />
              {viewUser?.name || viewUser?.email}
            </DialogTitle>
            <DialogDescription>User account details</DialogDescription>
          </DialogHeader>

          {viewUser && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-background shadow-sm">
                  {viewUser.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={viewUser.avatarUrl} alt={viewUser.name || viewUser.email} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-semibold text-primary">{initials(viewUser.name, viewUser.email)}</span>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-sm font-semibold">{viewUser.name || "Unnamed user"}</p>
                  <p className="text-xs text-muted-foreground">{getPrimaryRoleName(viewUser)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{viewUser.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{getPrimaryRoleName(viewUser)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {formatCreatedAt(viewUser.createdAt)}</span>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">All Roles</p>
                <div className="flex flex-wrap gap-1">
                  {viewUser.userRoles.map((ur) => (
                    <Badge key={ur.id} variant="secondary" className="text-[10px]">
                      {ur.role.name} ({ur.role.scope ?? (ur.role.key.startsWith("central_") ? "CENTRAL" : "TENANT")})
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete */}
      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected users?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {bulkDeletableUsers.length} users. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mb-2 max-h-40 overflow-y-auto rounded border p-2 text-xs">
            {bulkDeletableUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2">
                <span className="font-medium">{u.email}</span>
                <span className="text-muted-foreground">({getPrimaryRoleName(u)})</span>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleBulkDeleteConfirm}>
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
