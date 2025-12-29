"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { deleteRoleAction, upsertRoleAction } from "../roles-actions";
import { AppToast } from "@/components/ui/app-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  CheckSquare,
  Circle,
  Eye,
  Lock,
  Pencil,
  PlusCircle,
  Search,
  ShieldCheck,
  SquareDashedBottom,
  Trash2,
  X,
  Sparkles,
  KeyRound,
  ListChecks,
} from "lucide-react";

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

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { DataTable, type CompanySettingsInfo, type BrandingSettingsInfo } from "@/components/datatable/data-table";

export type PermissionDto = {
  id: string;
  key: string;
  name: string;
};

export type RoleDto = {
  id: string;
  key: string;
  name: string;
  scope: "CENTRAL" | "TENANT";
  tenantId: null;
  permissions: PermissionDto[];
};

type Props = {
  roles: RoleDto[];
  allPermissions: PermissionDto[];
  permissionsList?: string[];
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

type FilterType = "all" | "enabled" | "disabled";

const PROTECTED_ROLE_KEYS = ["central_superadmin"];

function slugifyRoleKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "role"
  );
}

function prettyError(msg?: string) {
  if (!msg) return "Something went wrong.";
  if (msg === "FORBIDDEN_CENTRAL") return "You don’t have access to manage central roles.";
  if (msg === "CANNOT_DELETE_PROTECTED_ROLE") return "This system role cannot be deleted.";
  if (msg === "CANNOT_CREATE_PROTECTED_ROLE") return "You can’t create a protected system role.";
  if (msg === "CANNOT_CHANGE_PROTECTED_KEY") return "You can’t change the key of a system role.";
  return msg;
}

export function RolesTab({
  roles,
  allPermissions,
  permissionsList = [],
  companySettings,
  brandingSettings,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const has = (key: string) => permissionsList.includes(key);

  const canViewRoles = has("roles.view") || has("manage_security") || has("view_security");
  const canCreateRoles = has("roles.create") || has("manage_security");
  const canUpdateRoles = has("roles.update") || has("manage_security");
  const canDeleteRoles = has("roles.delete") || has("manage_security");

  const isProtected = React.useCallback((key: string) => PROTECTED_ROLE_KEYS.includes(key), []);

  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [viewRole, setViewRole] = React.useState<RoleDto | null>(null);

  const [permissionSearch, setPermissionSearch] = React.useState("");
  const [permissionFilter, setPermissionFilter] = React.useState<FilterType>("all");

  // ✅ view modal search
  const [viewSearch, setViewSearch] = React.useState("");

  // ✅ auto key toggle (create + edit)
  const [autoKey, setAutoKey] = React.useState(true);

  const [form, setForm] = React.useState<{
    id: string | null;
    name: string;
    key: string;
    permissionIds: string[];
    isProtected: boolean;
  }>({
    id: null,
    name: "",
    key: "",
    permissionIds: [],
    isProtected: false,
  });

  const filteredPermissions = React.useMemo(() => {
    let result = allPermissions;

    if (permissionSearch.trim()) {
      const lower = permissionSearch.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(lower) || p.key.toLowerCase().includes(lower)
      );
    }

    if (permissionFilter === "enabled") {
      result = result.filter((p) => form.permissionIds.includes(p.id));
    } else if (permissionFilter === "disabled") {
      result = result.filter((p) => !form.permissionIds.includes(p.id));
    }

    return result;
  }, [allPermissions, permissionSearch, permissionFilter, form.permissionIds]);

  const handleSelectAll = () => {
    const idsToAdd = filteredPermissions.map((p) => p.id);
    setForm((prev) => ({
      ...prev,
      permissionIds: Array.from(new Set([...prev.permissionIds, ...idsToAdd])),
    }));
  };

  const handleDeselectAll = () => {
    const idsToRemove = new Set(filteredPermissions.map((p) => p.id));
    setForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.filter((id) => !idsToRemove.has(id)),
    }));
  };

  function openCreate() {
    if (!canCreateRoles) return;
    setAutoKey(true);
    setForm({ id: null, name: "", key: "", permissionIds: [], isProtected: false });
    setPermissionSearch("");
    setPermissionFilter("all");
    setCreateModalOpen(true);
  }

  function openEdit(role: RoleDto) {
    if (!canUpdateRoles) return;

    const protectedRole = isProtected(role.key);
    setAutoKey(!protectedRole);

    setForm({
      id: role.id,
      name: role.name,
      key: role.key,
      permissionIds: role.permissions.map((p) => p.id),
      isProtected: protectedRole,
    });

    setPermissionSearch("");
    setPermissionFilter("all");
    setCreateModalOpen(true);
  }

  function openView(role: RoleDto) {
    if (!canViewRoles) return;
    setViewRole(role);
    setViewSearch(""); // ✅ reset search each open
    setViewModalOpen(true);
  }

  function togglePermission(id: string) {
    if (form.isProtected) return;

    setForm((prev) => {
      const exists = prev.permissionIds.includes(id);
      return {
        ...prev,
        permissionIds: exists ? prev.permissionIds.filter((x) => x !== id) : [...prev.permissionIds, id],
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const isEdit = !!form.id;
    if (isEdit && !canUpdateRoles) return;
    if (!isEdit && !canCreateRoles) return;

    const toastId = AppToast.loading(isEdit ? "Updating role..." : "Creating role...", "Please wait");

    startTransition(async () => {
      try {
        await upsertRoleAction({
          id: form.id ?? null,
          name: form.name.trim(),
          key: form.key.trim(),
          permissionIds: Array.from(new Set(form.permissionIds)),
        });

        AppToast.dismiss(toastId);
        AppToast.success(isEdit ? "Role updated" : "Role created");
        setCreateModalOpen(false);
        router.refresh();
      } catch (err: any) {
        AppToast.dismiss(toastId);
        AppToast.error("Failed to save role", prettyError(err?.message));
      }
    });
  }

  const columns = React.useMemo<ColumnDef<RoleDto>[]>(
    () => [
      {
        id: "name",
        header: "Role Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <span className="font-semibold">{row.original.name}</span>
            {isProtected(row.original.key) && (
              <Badge variant="outline" className="text-[10px]">
                System
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "key",
        header: "System Key",
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {row.original.key}
          </Badge>
        ),
      },
      {
        id: "permissions",
        header: "Permissions",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.permissions.length} assigned</span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const role = row.original;
          const protectedRole = isProtected(role.key);

          const viewDisabled = !canViewRoles;
          const editDisabled = !canUpdateRoles || protectedRole;
          const deleteDisabled = !canDeleteRoles || protectedRole;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500"
                onClick={() => openView(role)}
                disabled={viewDisabled}
              >
                {viewDisabled ? <Lock className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500"
                onClick={() => openEdit(role)}
                disabled={editDisabled}
              >
                {editDisabled ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" disabled={deleteDisabled}>
                    {deleteDisabled ? <Lock className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent className="sm:max-w-md rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </span>
                      Delete Role?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will detach permissions from users with this role.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                      onClick={() =>
                        startTransition(async () => {
                          const tid = AppToast.loading("Deleting role...", "Please wait");
                          try {
                            await deleteRoleAction(role.id);
                            AppToast.dismiss(tid);
                            AppToast.success("Role deleted");
                            router.refresh();
                          } catch (e: any) {
                            AppToast.dismiss(tid);
                            AppToast.error("Failed to delete role", prettyError(e?.message));
                          }
                        })
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ],
    [canDeleteRoles, canUpdateRoles, canViewRoles, isProtected, router]
  );

  // ✅ view modal filtered perms
  const viewFilteredPermissions = React.useMemo(() => {
    const role = viewRole;
    if (!role) return [];

    const q = viewSearch.trim().toLowerCase();
    if (!q) return role.permissions;

    return role.permissions.filter(
      (p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
    );
  }, [viewRole, viewSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-1">
        <div>
          <h2 className="text-lg font-bold">Central Roles</h2>
          <p className="text-sm text-muted-foreground">Manage central admin users & capabilities.</p>
        </div>

        {canCreateRoles && (
          <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" /> Create Role
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <DataTable
          columns={columns}
          data={roles}
          searchColumnId="name"
          searchPlaceholder="Filter roles..."
          onRefresh={() => router.refresh()}
          fileName="central_roles"
          companySettings={companySettings ?? undefined}
          brandingSettings={brandingSettings ?? undefined}
        />
      </div>

      {/* CREATE/EDIT MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl p-0",
            "[&>button.absolute.right-4.top-4]:hidden"
          )}
        >
          {/* STICKY HEADER */}
          <div className="relative border-b shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-transparent to-emerald-600/10" />
            <div className="relative px-6 py-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </span>
                  {form.id ? "Edit Role" : "Create New Role"}
                </DialogTitle>
                <DialogDescription>Manage role identity and permissions.</DialogDescription>
              </DialogHeader>

              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background hover:bg-muted transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* SCROLLABLE BODY */}
          <ScrollArea className="flex-1 overflow-y-auto">
            <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Name</label>
                  <input
                    className="w-full rounded-xl border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    value={form.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setForm((p) => ({
                        ...p,
                        name: nextName,
                        key: autoKey ? slugifyRoleKey(nextName) : p.key,
                      }));
                    }}
                    required
                    disabled={form.isProtected}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Key</label>

                    {!form.isProtected && (
                      <button
                        type="button"
                        className={cn(
                          "text-[10px] rounded-full px-2 py-0.5 border transition",
                          autoKey
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setAutoKey((v) => !v)}
                        title="Toggle auto key generation"
                      >
                        {autoKey ? "Auto key: ON" : "Auto key: OFF"}
                      </button>
                    )}
                  </div>

                  <input
                    className="w-full rounded-xl border bg-background p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    value={form.key}
                    onChange={(e) => {
                      setAutoKey(false);
                      setForm((p) => ({ ...p, key: e.target.value }));
                    }}
                    required
                    disabled={form.isProtected || !!form.id}
                  />
                </div>
              </div>

              {/* Permission Selector */}
              <div className="space-y-3">
                <div className="flex flex-col gap-3 bg-muted/20 p-3 rounded-2xl border">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      placeholder="Search permissions..."
                      className="h-10 w-full rounded-xl border bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      disabled={form.isProtected}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1">
                      {(["all", "enabled", "disabled"] as const).map((f) => (
                        <Button
                          key={f}
                          type="button"
                          variant={permissionFilter === f ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-8 rounded-xl text-[11px] capitalize",
                            f === "enabled" && permissionFilter === f && "bg-emerald-600 hover:bg-emerald-700"
                          )}
                          onClick={() => setPermissionFilter(f)}
                          disabled={form.isProtected}
                        >
                          {f === "enabled" ? "Assigned" : f === "disabled" ? "Unassigned" : "All"}
                        </Button>
                      ))}
                    </div>

                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl text-[11px] text-indigo-600 dark:text-indigo-400"
                        onClick={handleSelectAll}
                        disabled={form.isProtected}
                      >
                        <CheckSquare className="mr-1 h-3.5 w-3.5" /> Select Visible
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl text-[11px] text-red-600 dark:text-red-400"
                        onClick={handleDeselectAll}
                        disabled={form.isProtected}
                      >
                        <SquareDashedBottom className="mr-1 h-3.5 w-3.5" /> Clear Visible
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1.5 pb-2">
                  {filteredPermissions.map((p) => {
                    const selected = form.permissionIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => togglePermission(p.id)}
                        disabled={form.isProtected}
                        className={cn(
                          "w-full rounded-xl px-3 py-3 text-left transition border",
                          selected
                            ? "border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-400/5"
                            : "border-transparent hover:border-border/60 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {selected ? (
                            <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate">{p.key}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {filteredPermissions.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">No permissions match your search.</div>
                  )}
                </div>
              </div>
            </form>
          </ScrollArea>

          {/* STICKY FOOTER */}
          <div className="shrink-0 border-t bg-background/80 backdrop-blur px-6 py-4 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl min-w-[100px] bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isPending}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {isPending ? "Saving..." : form.id ? "Update Role" : "Save Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW MODAL (✅ Attractive + Search) */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl p-0",
            "[&>button.absolute.right-4.top-4]:hidden"
          )}
        >
          {/* HEADER */}
          <div className="relative border-b shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-600/10 via-transparent to-indigo-600/10" />
            <div className="relative px-6 py-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20">
                    <ListChecks className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  </span>
                  {viewRole?.name ?? "Role Details"}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span className="font-mono">{viewRole?.key ?? "-"}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <span className="text-[11px] text-muted-foreground">
                    {viewRole?.permissions.length ?? 0} permissions
                  </span>
                </DialogDescription>
              </DialogHeader>

              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background hover:bg-muted transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="shrink-0 px-6 py-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search assigned permissions..."
                className="h-10 w-full rounded-xl border bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                value={viewSearch}
                onChange={(e) => setViewSearch(e.target.value)}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Showing <span className="font-medium text-foreground">{viewFilteredPermissions.length}</span>{" "}
                of <span className="font-medium text-foreground">{viewRole?.permissions.length ?? 0}</span>
              </span>
              {viewSearch.trim() && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => setViewSearch("")}
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* BODY */}
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-5">
              {!viewRole ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No role selected.
                </div>
              ) : viewFilteredPermissions.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No permissions match your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {viewFilteredPermissions.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border bg-muted/15 hover:bg-muted/25 transition px-3 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20">
                          <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground font-mono truncate">{p.key}</div>
                        </div>

                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          Assigned
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* FOOTER */}
          <div className="shrink-0 border-t bg-background/80 backdrop-blur px-6 py-4 flex items-center justify-end gap-3">
            <Button variant="outline" className="rounded-xl" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
