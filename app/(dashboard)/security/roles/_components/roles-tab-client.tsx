// app/(dashboard)/security/roles/_components/roles-tab-client.ts
"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
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
} from "@/components/ui/alert-dialog";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type CompanySettingsInfo, type BrandingSettingsInfo } from "@/components/datatable/data-table";

import {
  CheckCircle2,
  CheckSquare,
  Circle,
  Eye,
  KeyRound,
  ListChecks,
  Lock,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  SquareDashedBottom,
  Trash2,
  X,
} from "lucide-react";

import {
  createOrUpdateRoleAction,
  deleteRoleAction,
  fetchRolesTabAction, // ✅ NEW (server action that returns roles for a query)
  getRoleDetailsAction,
} from "../roles-actions";

export type PermissionLite = { id: string; key: string; name: string };

export type RoleForClient = {
  id: string;
  key: string;
  name: string;
  scope: "CENTRAL" | "TENANT";
  tenantId: string | null;
  createdAt: string;
  permissionsCount: number;
};

type Query = {
  page: number;
  pageSize: number;
  sortCol?: string;
  sortDir?: "asc" | "desc";
  search?: string;
};

type FilterType = "all" | "enabled" | "disabled";

type Props = {
  roles: RoleForClient[];
  totalEntries: number;
  allPermissions?: PermissionLite[];

  permissions: string[];
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

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
  if (msg === "FORBIDDEN_INSUFFICIENT_PERMISSIONS") return "You don’t have permission for this action.";
  if (msg === "ROLE_NOT_FOUND") return "Role not found.";
  return msg;
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

export function RolesTabClient(props: Props) {
  const router = useRouter();

  const {
    roles: initialRoles,
    totalEntries: initialTotal,
    allPermissions = [],
    permissions = [],
    companySettings,
    brandingSettings,
  } = props;

  // ✅ local state so deletes reflect instantly without full page reload
  const [rows, setRows] = React.useState<RoleForClient[]>(initialRoles);
  const [totalEntries, setTotalEntries] = React.useState<number>(initialTotal);

  const [isPending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const has = (key: string) => permissions.includes(key);
  const canView = has("roles.view") || has("manage_security");
  const canCreate = has("roles.create") || has("manage_security");
  const canUpdate = has("roles.update") || has("manage_security");
  const canDelete = has("roles.delete") || has("manage_security");

  const isProtectedRoleKey = React.useCallback((key: string) => PROTECTED_ROLE_KEYS.includes(key), []);
  const isProtectedRole = React.useCallback((r: RoleForClient) => isProtectedRoleKey(r.key), [isProtectedRoleKey]);

  const [query, setQuery] = React.useState<Query>({ page: 1, pageSize: 5 });
  const [loading, setLoading] = React.useState(false);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);
  const [bulkDeletableRoles, setBulkDeletableRoles] = React.useState<RoleForClient[]>([]);

  // ====== Fancy modals state ======
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [viewRole, setViewRole] = React.useState<{
    id: string;
    name: string;
    key: string;
    permissions: PermissionLite[];
  } | null>(null);

  const [viewSearch, setViewSearch] = React.useState("");

  // permission selector controls
  const [permissionSearch, setPermissionSearch] = React.useState("");
  const [permissionFilter, setPermissionFilter] = React.useState<FilterType>("all");

  // auto key toggle (create + edit)
  const [autoKey, setAutoKey] = React.useState(true);

  const [form, setForm] = React.useState<{
    id: string | null;
    name: string;
    key: string;
    permissionIds: string[];
    isProtected: boolean;
    loadingDetails: boolean;
  }>({
    id: null,
    name: "",
    key: "",
    permissionIds: [],
    isProtected: false,
    loadingDetails: false,
  });

  // ✅ fetch + hydrate table for current query
  async function refetch(nextQuery: Query) {
    setLoading(true);
    try {
      const payload = await fetchRolesTabAction({
        page: nextQuery.page,
        pageSize: nextQuery.pageSize,
        sortCol: (nextQuery.sortCol as any) ?? undefined,
        sortDir: nextQuery.sortDir,
        search: nextQuery.search,
      });

      setRows(payload.roles);
      setTotalEntries(payload.totalEntries);
      // allPermissions stays from initial props
    } finally {
      setLoading(false);
    }
  }

  // ====== Query handlers ======
  async function runQuery(updates: Partial<Query>) {
    const next: Query = {
      ...query,
      ...updates,
      page: updates.search !== undefined || updates.pageSize !== undefined ? 1 : updates.page ?? query.page,
    };

    setQuery(next);
    setRowSelection({});
    await refetch(next);
  }

  async function reloadCurrentQuery() {
    await refetch(query);
  }

  // ✅ after delete, keep pagination sane
  async function applyDeleteAndRefresh(deletedIds: string[]) {
    if (!deletedIds?.length) return;

    // optimistic remove (instant UI)
    setRows((prev) => prev.filter((r) => !deletedIds.includes(r.id)));
    setTotalEntries((prev) => Math.max(0, prev - deletedIds.length));

    // if page becomes empty and not first page -> go back one page
    const remainingOnPage = rows.filter((r) => !deletedIds.includes(r.id)).length;
    const nextPage = remainingOnPage === 0 && query.page > 1 ? query.page - 1 : query.page;

    const nextQuery: Query = { ...query, page: nextPage };

    setQuery(nextQuery);
    setRowSelection({});
    setBulkDeletableRoles([]);

    await refetch(nextQuery);
  }

  // ====== Create/Edit open ======
  function openCreate() {
    if (!canCreate) return;

    setAutoKey(true);
    setPermissionSearch("");
    setPermissionFilter("all");

    setForm({
      id: null,
      name: "",
      key: "",
      permissionIds: [],
      isProtected: false,
      loadingDetails: false,
    });

    setCreateModalOpen(true);
  }

  async function openEdit(r: RoleForClient) {
    if (!canUpdate) return;

    const protectedRole = isProtectedRoleKey(r.key);

    setAutoKey(!protectedRole);
    setPermissionSearch("");
    setPermissionFilter("all");

    // open first (fast UI), then load details
    setCreateModalOpen(true);
    setForm({
      id: r.id,
      name: r.name,
      key: r.key,
      permissionIds: [],
      isProtected: protectedRole,
      loadingDetails: true,
    });

    try {
      const detail = await getRoleDetailsAction({ roleId: r.id });
      setForm((prev) => ({
        ...prev,
        permissionIds: detail.permissionIds ?? [],
        loadingDetails: false,
      }));
    } catch (e: any) {
      setForm((prev) => ({ ...prev, loadingDetails: false }));
      toast.error(prettyError(e?.message));
    }
  }

  // ====== View modal ======
  async function openView(r: RoleForClient) {
    if (!canView) return;

    setViewModalOpen(true);
    setViewSearch("");
    setViewRole(null);

    try {
      const detail = await getRoleDetailsAction({ roleId: r.id });
      const perms = allPermissions.filter((p) => (detail.permissionIds ?? []).includes(p.id));

      setViewRole({
        id: r.id,
        name: r.name,
        key: r.key,
        permissions: perms,
      });
    } catch (e: any) {
      toast.error(prettyError(e?.message));
      setViewModalOpen(false);
    }
  }

  // ====== Permission selector ======
  const filteredPermissions = React.useMemo(() => {
    let result = allPermissions;

    if (permissionSearch.trim()) {
      const lower = permissionSearch.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(lower) || p.key.toLowerCase().includes(lower));
    }

    if (permissionFilter === "enabled") {
      result = result.filter((p) => form.permissionIds.includes(p.id));
    } else if (permissionFilter === "disabled") {
      result = result.filter((p) => !form.permissionIds.includes(p.id));
    }

    return result;
  }, [allPermissions, permissionSearch, permissionFilter, form.permissionIds]);

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

  const handleSelectAll = () => {
    if (form.isProtected) return;
    const idsToAdd = filteredPermissions.map((p) => p.id);
    setForm((prev) => ({
      ...prev,
      permissionIds: Array.from(new Set([...prev.permissionIds, ...idsToAdd])),
    }));
  };

  const handleDeselectAll = () => {
    if (form.isProtected) return;
    const idsToRemove = new Set(filteredPermissions.map((p) => p.id));
    setForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.filter((id) => !idsToRemove.has(id)),
    }));
  };

  // ====== Submit ======
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const isEdit = !!form.id;
    if (isEdit && !canUpdate) return;
    if (!isEdit && !canCreate) return;

    const tid = toast.loading(isEdit ? "Updating role..." : "Creating role...");

    startTransition(async () => {
      try {
        await createOrUpdateRoleAction({
          id: form.id ?? null,
          name: form.name.trim(),
          key: form.key.trim(),
          permissionIds: Array.from(new Set(form.permissionIds)),
        });

        toast.dismiss(tid);
        toast.success(isEdit ? "Role updated" : "Role created");
        setCreateModalOpen(false);

        await reloadCurrentQuery();
        router.refresh(); // optional
      } catch (err: any) {
        toast.dismiss(tid);
        toast.error(prettyError(err?.message));
      }
    });
  }

  // ====== Delete bulk + single ======
  function handleBulkDeleteConfirm() {
    if (!canDelete) return;

    startTransition(async () => {
      try {
        if (!bulkDeletableRoles.length) {
          setBulkDialogOpen(false);
          return;
        }

        const res = await deleteRoleAction({ roleIds: bulkDeletableRoles.map((r) => r.id) });

        if (res.blocked > 0) toast.warning("Some roles could not be deleted (protected or in use).");
        if (res.deleted > 0) toast.success("Selected roles deleted.");

        setBulkDialogOpen(false);
        setBulkDeletableRoles([]);
        setRowSelection({});

        await applyDeleteAndRefresh(res.deletedIds ?? []);
      } catch (e: any) {
        toast.error(prettyError(e?.message));
      }
    });
  }

  // ====== Table columns ======
  const columns = React.useMemo<ColumnDef<RoleForClient>[]>(() => {
    return [
      {
        id: "name",
        header: "Role",
        accessorFn: (row) => `${row.name} ${row.key}`,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{r.name}</span>
              <span className="text-xs text-muted-foreground">{r.key}</span>
            </div>
          );
        },
      },
      {
        id: "scope",
        header: "Scope",
        accessorFn: (row) => row.scope,
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-muted/50 font-normal">
            {row.original.scope}
          </Badge>
        ),
      },
      {
        id: "permissionsCount",
        header: "Permissions",
        accessorFn: (row) => row.permissionsCount,
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.permissionsCount}</span>,
      },
      {
        id: "createdAt",
        header: "Created",
        accessorFn: (row) => formatCreatedAt(row.createdAt),
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatCreatedAt(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const r = row.original;
          const protectedRole = isProtectedRole(r);

          const viewDisabled = !canView;
          const editDisabled = !canUpdate;
          const deleteDisabled = protectedRole || !canDelete || isPending;

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(r)}
                disabled={viewDisabled}
                title={viewDisabled ? "No permission" : "View Details"}
              >
                {viewDisabled ? <Lock className="h-3 w-3 opacity-70" /> : <Eye className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                onClick={() => openEdit(r)}
                disabled={editDisabled}
                title={editDisabled ? "No permission" : "Edit Role"}
              >
                {editDisabled ? <Lock className="h-3 w-3 opacity-70" /> : <Pencil className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:bg-red-50"
                disabled={deleteDisabled}
                title={deleteDisabled ? "Protected / No permission" : "Delete Role"}
                onClick={() => {
                  setBulkDeletableRoles([r]); // single delete uses same confirm dialog
                  setBulkDialogOpen(true);
                }}
              >
                {deleteDisabled ? <Lock className="h-3 w-3 opacity-50" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
        meta: { exportable: false, printable: false, align: "right" },
      },
    ];
  }, [canView, canUpdate, canDelete, isPending, isProtectedRole, openView, openEdit]);

  // ====== view modal perms filter ======
  const viewFilteredPermissions = React.useMemo(() => {
    if (!viewRole) return [];
    const q = viewSearch.trim().toLowerCase();
    if (!q) return viewRole.permissions;
    return viewRole.permissions.filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q));
  }, [viewRole, viewSearch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 p-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Roles</h2>
          <p className="text-sm text-muted-foreground">Manage platform roles and permissions.</p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate && (
            <Button onClick={openCreate} className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <DataTable<RoleForClient, any>
          title="Roles"
          description="Central roles for the platform"
          columns={columns}
          data={rows} // ✅ state
          totalEntries={totalEntries} // ✅ state
          loading={loading}
          pageIndex={query.page}
          pageSize={query.pageSize}
          onQueryChange={(q) => runQuery(q as Partial<Query>)}
          enableRowSelection
          selectedRowIds={rowSelection}
          onSelectionChange={({ selectedRowIds, selectedRowsOnPage }) => {
            setRowSelection(selectedRowIds);
            const deletable = selectedRowsOnPage.filter((r) => !isProtectedRole(r));
            setBulkDeletableRoles(deletable);
          }}
          onDeleteRows={async (rowsToDelete) => {
            const deletable = rowsToDelete.filter((r) => !isProtectedRole(r));
            if (!deletable.length) {
              toast.error("Nothing to delete (protected role selected).");
              return;
            }
            setBulkDeletableRoles(deletable);
            setBulkDialogOpen(true);
          }}
          companySettings={companySettings ?? undefined}
          brandingSettings={brandingSettings ?? undefined}
        />
      </div>

      {/* ===== CREATE / EDIT MODAL (fancy) ===== */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent
          className={[
            "sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl p-0",
            "[&>button.absolute.right-4.top-4]:hidden",
          ].join(" ")}
        >
          {/* sticky header */}
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

          {/* body */}
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
                    disabled={form.isProtected || form.loadingDetails}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Key</label>

                    {!form.isProtected && (
                      <button
                        type="button"
                        className={[
                          "text-[10px] rounded-full px-2 py-0.5 border transition",
                          autoKey
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground",
                        ].join(" ")}
                        onClick={() => setAutoKey((v) => !v)}
                        title="Toggle auto key generation"
                        disabled={form.loadingDetails}
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
                    disabled={form.isProtected || !!form.id || form.loadingDetails}
                  />
                </div>
              </div>

              {/* Permission selector */}
              <div className="space-y-3">
                <div className="flex flex-col gap-3 bg-muted/20 p-3 rounded-2xl border">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      placeholder="Search permissions..."
                      className="h-10 w-full rounded-xl border bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      disabled={form.isProtected || form.loadingDetails}
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
                          className={[
                            "h-8 rounded-xl text-[11px] capitalize",
                            f === "enabled" && permissionFilter === f ? "bg-emerald-600 hover:bg-emerald-700" : "",
                          ].join(" ")}
                          onClick={() => setPermissionFilter(f)}
                          disabled={form.isProtected || form.loadingDetails}
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
                        disabled={form.isProtected || form.loadingDetails}
                      >
                        <CheckSquare className="mr-1 h-3.5 w-3.5" /> Select Visible
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl text-[11px] text-red-600 dark:text-red-400"
                        onClick={handleDeselectAll}
                        disabled={form.isProtected || form.loadingDetails}
                      >
                        <SquareDashedBottom className="mr-1 h-3.5 w-3.5" /> Clear Visible
                      </Button>
                    </div>
                  </div>
                </div>

                {form.loadingDetails ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Loading role permissions…
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 pb-2">
                    {filteredPermissions.map((p) => {
                      const selected = form.permissionIds.includes(p.id);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => togglePermission(p.id)}
                          disabled={form.isProtected}
                          className={[
                            "w-full rounded-xl px-3 py-3 text-left transition border",
                            selected
                              ? "border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-400/5"
                              : "border-transparent hover:border-border/60 hover:bg-muted/40",
                          ].join(" ")}
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
                )}
              </div>
            </form>
          </ScrollArea>

          {/* sticky footer */}
          <div className="shrink-0 border-t bg-background/80 backdrop-blur px-6 py-4 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl min-w-[100px] bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isPending || form.loadingDetails}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {isPending ? "Saving..." : form.id ? "Update Role" : "Save Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== VIEW MODAL (fancy + search) ===== */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent
          className={[
            "sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl p-0",
            "[&>button.absolute.right-4.top-4]:hidden",
          ].join(" ")}
        >
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
                Showing <span className="font-medium text-foreground">{viewFilteredPermissions.length}</span> of{" "}
                <span className="font-medium text-foreground">{viewRole?.permissions.length ?? 0}</span>
              </span>

              {viewSearch.trim() && (
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setViewSearch("")}>
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-5">
              {!viewRole ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Loading role details…
                </div>
              ) : viewFilteredPermissions.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No permissions match your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {viewFilteredPermissions.map((p) => (
                    <div key={p.id} className="rounded-xl border bg-muted/15 hover:bg-muted/25 transition px-3 py-3">
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

          <div className="shrink-0 border-t bg-background/80 backdrop-blur px-6 py-4 flex items-center justify-end gap-3">
            <Button variant="outline" className="rounded-xl" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== BULK DELETE CONFIRM ===== */}
      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected roles?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {bulkDeletableRoles.length} roles. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mb-2 max-h-40 overflow-y-auto rounded border p-2 text-xs">
            {bulkDeletableRoles.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">({r.key})</span>
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
