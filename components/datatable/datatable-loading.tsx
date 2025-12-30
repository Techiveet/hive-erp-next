// components/datatable-loading.tsx
export default function DataTableLoading({
  titleWidth = "w-40",
  descWidth = "w-64",
  rows = 8,
  cols = 6,
}: {
  titleWidth?: string;
  descWidth?: string;
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="w-full space-y-4">
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Optional header (title/description) */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className={`h-6 ${titleWidth} bg-slate-200 dark:bg-slate-700 rounded animate-pulse`} />
          <div className={`mt-2 h-4 ${descWidth} bg-slate-200 dark:bg-slate-700 rounded animate-pulse`} />
        </div>

        {/* Toolbar skeleton */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {/* search */}
              <div className="h-9 w-full sm:w-[260px] bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              {/* date filters */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-9 w-[130px] bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-4 w-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-9 w-[130px] bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              </div>
              {/* filter chips */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
                <div className="h-9 w-28 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-9 sm:w-[90px] bg-slate-100 dark:bg-slate-800 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Table skeleton */}
        <div className="border-t border-slate-100 dark:border-slate-800">
          {/* header row */}
          <div className="bg-slate-50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800">
            <div className="grid gap-4 px-4 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {Array.from({ length: cols }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* body rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="px-4 py-3">
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: cols }).map((_, c) => (
                    <div
                      key={c}
                      className={`h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ${
                        c === 0 ? "w-12" : c === cols - 1 ? "w-24" : "w-full"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer /a pagination skeleton */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-8 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="hidden sm:block h-4 w-56 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
