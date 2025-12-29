import DataTableLoading from "@/components/datatable/datatable-loading";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-1">
        <div>
          <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="mt-2 h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>

      <div className="rounded-md border bg-card">
        <DataTableLoading rows={8} cols={4} />
      </div>
    </div>
  );
}
