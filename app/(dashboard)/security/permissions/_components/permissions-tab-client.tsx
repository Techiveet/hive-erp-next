// app/(dashboard)/security/permissions/_components/permissions-tab-client.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Eye, Globe, KeyRound, Lock, Pencil, PlusCircle, Trash2, X, Sparkles } from "lucide-react";

import { deletePermissionAction, fetchPermissionsTabAction, upsertPermissionAction } from "../permissions-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DataTable, type CompanySettingsInfo, type BrandingSettingsInfo } from "@/components/datatable/data-table";
import { cn } from "@/lib/utils";

export type PermissionWithFlag = {
  id: string;
  name: string;
  key: string;
  isGlobal: boolean; // true = system/global permission
};

type SortCol = "name" | "key";

type Query = {
  page: number;
  pageSize: number;
  sortCol?: SortCol;
  sortDir?: "asc" | "desc";
  search?: string;
};

type Props = {
  permissions: PermissionWithFlag[];
  totalEntries: number;

  permissionsList: string[];
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

function slugifyPermissionKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "") || "permission"
  );
}

function prettyError(msg?: string) {
  if (!msg) return "Something went wrong.";
  if (msg === "PERMISSION_KEY_IN_USE") return "This permission key is already in use.";
  if (msg === "PERMISSION_IN_USE") return "This permission is used by at least one role.";
  if (msg === "KEY_RESERVED_FOR_SYSTEM") return "This key is reserved for the system.";
  if (msg === "FORBIDDEN_INSUFFICIENT_PERMISSIONS") return "You don’t have permission to do this.";
  if (msg === "CANNOT_DELETE_SYSTEM_PERMISSION") return "System permissions cannot be deleted.";
  if (msg === "CANNOT_MODIFY_SYSTEM_PERMISSION") return "System permissions cannot be edited.";
  if (msg === "NOT_FOUND") return "Permission not found.";
  return msg;
}

function normalizeSortCol(v: unknown, fallback?: SortCol): SortCol | undefined {
  if (v === "name" || v === "key") return v;
  return fallback;
}

function normalizeSortDir(v: unknown, fallback?: "asc" | "desc"): "asc" | "desc" | undefined {
  if (v === "asc" || v === "desc") return v;
  return fallback;
}

export function PermissionsTabClient({
  permissions: initialRows,
  totalEntries: initialTotal,
  permissionsList = [],
  companySettings,
  brandingSettings,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const has = React.useCallback((k: string) => permissionsList.includes(k), [permissionsList]);

  const canView = has("permissions.view") || has("manage_security") || has("view_security");
  const canCreate = has("permissions.create") || has("manage_security");
  const canUpdate = has("permissions.update") || has("manage_security");
  const canDelete = has("permissions.delete") || has("manage_security");

  // ✅ local table state (no stale UI)
  const [rows, setRows] = React.useState<PermissionWithFlag[]>(initialRows);
  const [totalEntries, setTotalEntries] = React.useState<number>(initialTotal);

  const [query, setQuery] = React.useState<Query>({ page: 1, pageSize: 10 });
  const [loading, setLoading] = React.useState(false);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);
  const [bulkDeletable, setBulkDeletable] = React.useState<PermissionWithFlag[]>([]);

  // modals
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewPerm, setViewPerm] = React.useState<PermissionWithFlag | null>(null);

  const [autoKey, setAutoKey] = React.useState(true);

  const [form, setForm] = React.useState<{ id: string | null; name: string; key: string }>({
    id: null,
    name: "",
    key: "",
  });

  async function refetch(nextQuery: Query) {
    setLoading(true);
    try {
      // ✅ now type-safe: Query matches server expected union types
      const payload = await fetchPermissionsTabAction(nextQuery);
      setRows(payload.permissions);
      setTotalEntries(payload.totalEntries);
    } finally {
      setLoading(false);
    }
  }

  async function runQuery(updates: Partial<Query>) {
    const next: Query = {
      ...query,
      ...updates,
      // ✅ sanitize in case DataTable passes arbitrary strings
      sortCol: normalizeSortCol((updates as any).sortCol, query.sortCol),
      sortDir: normalizeSortDir((updates as any).sortDir, query.sortDir),
      page: updates.search !== undefined || updates.pageSize !== undefined ? 1 : updates.page ?? query.page,
    };

    setQuery(next);
    setRowSelection({});
    await refetch(next);
  }

  async function reloadCurrentQuery() {
    await refetch(query);
  }

  async function applyDeleteAndRefresh(deletedIds: string[]) {
    if (!deletedIds?.length) return;

    // optimistic
    setRows((prev) => prev.filter((r) => !deletedIds.includes(r.id)));
    setTotalEntries((prev) => Math.max(0, prev - deletedIds.length));

    const remainingOnPage = rows.filter((r) => !deletedIds.includes(r.id)).length;
    const nextPage = remainingOnPage === 0 && query.page > 1 ? query.page - 1 : query.page;

    const nextQuery: Query = { ...query, page: nextPage };
    setQuery(nextQuery);
    setRowSelection({});
    setBulkDeletable([]);

    await refetch(nextQuery);
  }

  const openCreate = React.useCallback(() => {
    if (!canCreate) return;
    setAutoKey(true);
    setForm({ id: null, name: "", key: "" });
    setCreateOpen(true);
  }, [canCreate]);

  const openEdit = React.useCallback(
    (p: PermissionWithFlag) => {
      if (!canUpdate) return;

      if (p.isGlobal) {
        toast.error(prettyError("CANNOT_MODIFY_SYSTEM_PERMISSION"));
        return;
      }

      setAutoKey(false);
      setForm({ id: p.id, name: p.name, key: p.key });
      setCreateOpen(true);
    },
    [canUpdate]
  );

  const openView = React.useCallback(
    (p: PermissionWithFlag) => {
      if (!canView) return;
      setViewPerm(p);
      setViewOpen(true);
    },
    [canView]
  );

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const isEdit = !!form.id;
      if (isEdit && !canUpdate) return;
      if (!isEdit && !canCreate) return;

      const tid = toast.loading(isEdit ? "Updating permission..." : "Creating permission...");

      startTransition(async () => {
        try {
          await upsertPermissionAction({
            id: form.id ?? null,
            name: form.name.trim(),
            key: form.key.trim(),
          });

          toast.dismiss(tid);
          toast.success(isEdit ? "Permission updated" : "Permission created");
          setCreateOpen(false);

          await reloadCurrentQuery();
          router.refresh();
        } catch (err: any) {
          toast.dismiss(tid);
          toast.error(prettyError(err?.message));
        }
      });
    },
    [form, canCreate, canUpdate, router]
  );

  function confirmBulkDelete(rowsToDelete: PermissionWithFlag[]) {
    if (!canDelete) return;

    // ✅ lock system permissions
    const deletable = rowsToDelete.filter((r) => !r.isGlobal);

    if (!deletable.length) {
      toast.warning("Nothing to delete (system permissions are locked).");
      return;
    }

    setBulkDeletable(deletable);
    setBulkDialogOpen(true);
  }

  function handleBulkDeleteConfirm() {
    if (!canDelete) return;

    startTransition(async () => {
      const ids = bulkDeletable.map((r) => r.id);
      const tid = toast.loading("Deleting selected permissions...");

      try {
        const res = await deletePermissionAction(ids); // ✅ single call

        toast.dismiss(tid);
        if (res.blocked > 0) toast.warning(`Deleted ${res.deleted}. Blocked ${res.blocked} (in use).`);
        if (res.deleted > 0) toast.success("Selected permissions deleted.");

        setBulkDialogOpen(false);
        setBulkDeletable([]);
        setRowSelection({});

        await applyDeleteAndRefresh(res.deletedIds ?? []);
      } catch (err: any) {
        toast.dismiss(tid);
        toast.error(prettyError(err?.message));
      }
    });
  }

  const columns = React.useMemo<ColumnDef<PermissionWithFlag>[]>(() => {
    return [
      {
        id: "name",
        header: "Permission",
        accessorFn: (row) => `${row.name} ${row.key}`,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.isGlobal ? (
              <Globe className="h-3 w-3 text-muted-foreground" />
            ) : (
              <KeyRound className="h-3 w-3 text-indigo-500" />
            )}
            <span className="font-medium text-sm">{row.original.name}</span>
          </div>
        ),
      },
      {
        id: "key",
        header: "Key",
        accessorFn: (row) => row.key,
        cell: ({ row }) => <code className="bg-muted px-1 py-0.5 rounded text-[10px] font-mono">{row.original.key}</code>,
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => (row.isGlobal ? "System" : "Custom"),
        cell: ({ row }) =>
          row.original.isGlobal ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              System
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-normal border-indigo-200 text-indigo-700 bg-indigo-50">
              Custom
            </Badge>
          ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const p = row.original;
          const isLocked = p.isGlobal;

          const viewDisabled = !canView;
          const editDisabled = !canUpdate || isLocked;
          const deleteDisabled = !canDelete || isLocked || isPending;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(p)}
                disabled={viewDisabled}
                title={viewDisabled ? "No permission" : "View"}
              >
                {viewDisabled ? <Lock className="h-4 w-4 opacity-50" /> : <Eye className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                onClick={() => openEdit(p)}
                disabled={editDisabled}
                title={editDisabled ? "Cannot edit" : "Edit"}
              >
                {editDisabled ? <Lock className="h-4 w-4 opacity-50" /> : <Pencil className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:bg-red-50"
                disabled={deleteDisabled}
                title={deleteDisabled ? "Cannot delete" : "Delete"}
                onClick={() => confirmBulkDelete([p])}
              >
                {deleteDisabled ? <Lock className="h-4 w-4 opacity-50" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
        meta: { exportable: false, printable: false, align: "right" },
      },
    ];
  }, [canDelete, canUpdate, canView, isPending, openEdit, openView]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-1">
        <div>
          <h2 className="text-lg font-bold">Permissions</h2>
          <p className="text-sm text-muted-foreground">Fine-grained access controls.</p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate && (
            <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Permission
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <DataTable<PermissionWithFlag, any>
          title="Permissions"
          description="System + custom permissions"
          columns={columns}
          data={rows}
          totalEntries={totalEntries}
          loading={loading}
          pageIndex={query.page}
          pageSize={query.pageSize}
          onQueryChange={(q) => runQuery(q as Partial<Query>)}
          enableRowSelection
          selectedRowIds={rowSelection}
          onSelectionChange={({ selectedRowIds, selectedRowsOnPage }) => {
            setRowSelection(selectedRowIds);
            setBulkDeletable(selectedRowsOnPage.filter((r) => !r.isGlobal));
          }}
          onDeleteRows={async (rowsToDelete) => confirmBulkDelete(rowsToDelete)}
          companySettings={companySettings ?? undefined}
          brandingSettings={brandingSettings ?? undefined}
        />
      </div>

      {/* CREATE / EDIT */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl p-0",
            "[&>button.absolute.right-4.top-4]:hidden"
          )}
        >
          <div className="relative border-b">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-transparent to-emerald-600/10" />
            <div className="relative px-6 py-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </span>
                  {form.id ? "Edit Permission" : "Create Permission"}
                </DialogTitle>
                <DialogDescription>Use a stable key for code checks (RBAC).</DialogDescription>
              </DialogHeader>

              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background hover:bg-muted transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
                      key: autoKey ? slugifyPermissionKey(nextName) : p.key,
                    }));
                  }}
                  required
                  placeholder="e.g. Create Users"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Key</label>

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
                </div>

                <input
                  className="w-full rounded-xl border bg-background p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  value={form.key}
                  onChange={(e) => {
                    setAutoKey(false);
                    setForm((p) => ({ ...p, key: e.target.value }));
                  }}
                  required
                  placeholder="e.g. users.create"
                />

                {form.name.trim() && (
                  <div className="text-[11px] text-muted-foreground">
                    Saved as: <span className="font-mono">{form.key || slugifyPermissionKey(form.name)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* VIEW */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permission Details</DialogTitle>
            <DialogDescription>Read-only view.</DialogDescription>
          </DialogHeader>

          {viewPerm && (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-3 items-center border-b pb-2">
                <span className="font-medium text-muted-foreground">Name</span>
                <span className="col-span-2 font-semibold">{viewPerm.name}</span>
              </div>

              <div className="grid grid-cols-3 items-center border-b pb-2">
                <span className="font-medium text-muted-foreground">Key</span>
                <span className="col-span-2 font-mono bg-muted px-1 rounded">{viewPerm.key}</span>
              </div>

              <div className="grid grid-cols-3 items-center border-b pb-2">
                <span className="font-medium text-muted-foreground">Type</span>
                <span className="col-span-2">
                  {viewPerm.isGlobal ? (
                    <Badge variant="secondary">System</Badge>
                  ) : (
                    <Badge variant="outline" className="border-indigo-500 text-indigo-500">
                      Custom
                    </Badge>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-3 items-center">
                <span className="font-medium text-muted-foreground">ID</span>
                <span className="col-span-2 text-xs text-muted-foreground">{viewPerm.id}</span>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setViewOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BULK DELETE CONFIRM */}
      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {bulkDeletable.length} permissions. This cannot be undone.
              <br />
              System permissions are locked and won’t appear here.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mb-2 max-h-40 overflow-y-auto rounded border p-2 text-xs">
            {bulkDeletable.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">({p.key})</span>
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
