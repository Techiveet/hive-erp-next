// components/datatable.tsx
"use client";

import * as React from "react";

import {
  ChevronLeft,
  ChevronRight,
  Columns as ColumnsIcon,
  Copy,
  Download,
  Printer,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  Table as TanTable,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DataTableCard,
  DataTableCardContent,
  DataTableCardDescription,
  DataTableCardFooter,
  DataTableCardHeader,
  DataTableCardTitle,
} from "@/components/ui/datatable-card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* -------------------- Column meta augmentation -------------------- */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    exportable?: boolean;
    printable?: boolean;
    exportValue?: (row: TData) => unknown;
    align?: "left" | "center" | "right";
  }
}

/* ---------------------- Company settings type --------------------- */
export type CompanySettingsInfo = {
  companyName?: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
};

/* ---------------------- Branding settings type -------------------- */
export type BrandingSettingsInfo = {
  darkLogoUrl?: string;
};

/* ----------------------------- Types & Props ----------------------------- */
export type DataTableFilter = {
  columnId: string;
  title: string;
  options: { label: string; value: string }[];
};

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data?: TData[];

  title?: string;
  description?: string;

  // server mode
  serverMode?: boolean;
  totalEntries?: number;
  onQueryChange?: (q: {
    page: number; // 1-indexed
    pageSize: number;
    sortCol?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => void;

  searchColumnId?: string;
  searchPlaceholder?: string;
  filters?: DataTableFilter[];

  onDeleteRows?: (rows: TData[]) => Promise<void> | void;

  pageSize?: number;
  pageSizeOptions?: number[];

  onRefresh?: () => Promise<void> | void;
  onReload?: () => Promise<void> | void;

  fileName?: string;
  className?: string;

  /** Scroll container selector ("body" by default). Pass false to disable. */
  scrollTo?: string | false;

  /** Optional date column id (e.g. "createdAt") for the date filter (client mode only) */
  dateFilterColumnId?: string;

  /** Company settings for PDF + Print headers */
  companySettings?: CompanySettingsInfo;

  /** Branding settings (e.g. dark logo) for PDF + Print */
  brandingSettings?: BrandingSettingsInfo;

  /** If true, auto-select all filtered rows when any filter/search/date is active */
  autoSelectFilteredRows?: boolean;

  /** Debounce for server search (ms) */
  serverSearchDebounceMs?: number;
}

/* ---------------------------- small hooks ---------------------------- */
function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------------------------- Column helpers ---------------------------- */
function getExportableColumns<T>(table: TanTable<T>) {
  return table
    .getAllLeafColumns()
    .filter(
      (c) =>
        c.getIsVisible() &&
        c.columnDef?.meta?.exportable !== false &&
        !["seq", "select", "actions"].includes(c.id)
    );
}

function getPrintableColumns<T>(table: TanTable<T>) {
  return table
    .getAllLeafColumns()
    .filter(
      (c) =>
        c.getIsVisible() &&
        c.columnDef?.meta?.printable !== false &&
        !["seq", "select", "actions"].includes(c.id)
    );
}

function getSafeFilteredRows<T>(table: TanTable<T>) {
  const filtered = table.getFilteredRowModel?.();
  return filtered?.rows?.length ? filtered.rows : table.getRowModel().rows;
}

/* ---------------------------- clipboard/export ---------------------------- */
function toClipboardTable<T>(table: TanTable<T>, rows?: Row<T>[]) {
  const cols = getExportableColumns(table);
  const dataRows = rows ?? getSafeFilteredRows(table);

  const header = [
    "No.",
    ...cols.map((c) =>
      typeof c.columnDef.header === "string" ? c.columnDef.header : c.id
    ),
  ].join("\t");

  const lines = dataRows.map((r, rowIndex) =>
    [
      String(rowIndex + 1),
      ...cols.map((c) => {
        const meta = (c.columnDef.meta || {}) as any;
        const raw =
          typeof meta.exportValue === "function"
            ? meta.exportValue(r.original)
            : r.getValue<any>(c.id);

        if (raw == null) return "";
        return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      }),
    ].join("\t")
  );

  return [header, ...lines].join("\n");
}

async function copyTableToClipboard<T>(table: TanTable<T>, rows?: Row<T>[]) {
  try {
    const text = toClipboardTable(table, rows);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.success("Data copied to clipboard");
  } catch {
    toast.error("Copy failed");
  }
}

function toCsv<T>(table: TanTable<T>, rows?: Row<T>[]) {
  const cols = getExportableColumns(table);
  const dataRows = rows ?? getSafeFilteredRows(table);

  const header = [
    "No.",
    ...cols.map((c) =>
      typeof c.columnDef.header === "string" ? c.columnDef.header : c.id
    ),
  ].join(",");

  const lines = dataRows.map((r, rowIndex) =>
    [
      String(rowIndex + 1),
      ...cols.map((c) => {
        const meta = (c.columnDef.meta || {}) as any;
        const raw =
          typeof meta.exportValue === "function"
            ? meta.exportValue(r.original)
            : r.getValue<any>(c.id);

        const s =
          raw == null
            ? ""
            : typeof raw === "object"
              ? JSON.stringify(raw)
              : String(raw);

        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }),
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

function downloadCsv<T>(table: TanTable<T>, fileName = "export", rows?: Row<T>[]) {
  const csv = toCsv(table, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportXlsx<T>(table: TanTable<T>, fileName = "export", rows?: Row<T>[]) {
  try {
    const XLSX = await import("xlsx");
    const cols = getExportableColumns(table);
    const dataRows = rows ?? getSafeFilteredRows(table);

    const data = dataRows.map((r, idx) => {
      const rowObj: Record<string, any> = { "No.": idx + 1 };
      cols.forEach((c) => {
        const header =
          typeof c.columnDef.header === "string" ? c.columnDef.header : c.id;
        const meta = (c.columnDef.meta || {}) as any;
        const val =
          typeof meta.exportValue === "function"
            ? meta.exportValue(r.original)
            : r.getValue(c.id);
        rowObj[header] = val;
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    toast.success("XLSX exported");
  } catch (err) {
    console.error(err);
    toast.error("XLSX export failed (npm i xlsx)");
  }
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to load logo for PDF:", e);
    return null;
  }
}

/* ------------------------ PDF export (with company) ------------------------ */
async function exportPdf<T>(
  table: TanTable<T>,
  fileName = "export",
  rowsArg?: Row<T>[],
  companySettings?: CompanySettingsInfo,
  brandingSettings?: BrandingSettingsInfo
) {
  try {
    const jsPDFmod = await import("jspdf");
    const JsPDFCtor: any = (jsPDFmod as any).default || (jsPDFmod as any).jsPDF;
    const autoTableMod: any = await import("jspdf-autotable");
    const autoTableFn: any = autoTableMod.default || (autoTableMod as any);

    const cols = getExportableColumns(table);
    const rows = rowsArg ?? getSafeFilteredRows(table);
    if (!rows.length) return;

    const head = [
      [
        "No.",
        ...cols.map((c) =>
          typeof c.columnDef.header === "string" ? c.columnDef.header : c.id
        ),
      ],
    ];

    const body = rows.map((r, rowIndex) => [
      String(rowIndex + 1),
      ...cols.map((c) => {
        const meta = (c.columnDef.meta || {}) as any;
        const raw =
          typeof meta.exportValue === "function"
            ? meta.exportValue(r.original)
            : r.getValue<any>(c.id);
        if (raw == null) return "";
        return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      }),
    ]);

    const doc = new JsPDFCtor({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    let headerTop = 14;

    if (brandingSettings?.darkLogoUrl) {
      const dataUrl = await loadImageAsDataUrl(brandingSettings.darkLogoUrl);
      if (dataUrl) {
        const imgWidth = 32;
        const imgHeight = 16;
        const x = pageWidth - imgWidth - 12;
        const y = 10;
        doc.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight);
        headerTop = Math.max(headerTop, y + imgHeight + 4);
      }
    }

    const cs = companySettings;
    let y = headerTop;

    doc.setFontSize(12);
    doc.text((cs?.companyName || cs?.legalName || fileName).toUpperCase(), 14, y);
    y += 6;

    const addressParts = [
      cs?.addressLine1,
      cs?.addressLine2,
      [cs?.city, cs?.state].filter(Boolean).join(", "),
      [cs?.postalCode, cs?.country].filter(Boolean).join(" "),
    ].filter((line) => !!line && line.trim().length);

    if (addressParts.length) {
      doc.setFontSize(9);
      addressParts.forEach((line) => {
        doc.text(line!, 14, y);
        y += 4;
      });
    }

    const contactParts = [
      cs?.phone ? `Tel: ${cs.phone}` : null,
      cs?.email ? `Email: ${cs.email}` : null,
      cs?.website ? `Web: ${cs.website}` : null,
    ].filter(Boolean);

    if (contactParts.length) {
      doc.setFontSize(9);
      doc.text(contactParts.join("   "), 14, y);
      y += 5;
    }

    const taxParts = [
      cs?.taxId ? `Tax ID: ${cs.taxId}` : null,
      cs?.registrationNumber ? `Reg No: ${cs.registrationNumber}` : null,
    ].filter(Boolean);

    if (taxParts.length) {
      doc.setFontSize(9);
      doc.text(taxParts.join("   "), 14, y);
      y += 5;
    }

    y += 3;

    autoTableFn(doc, {
      head,
      body,
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        valign: "top",
        overflow: "linebreak",
        cellWidth: "wrap",
      },
      headStyles: {
        fontSize: 9,
        fontStyle: "bold",
        fillColor: [245, 245, 245],
        textColor: 40,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: y, left: 12, right: 12, bottom: 12 },
      tableWidth: "auto",
    });

    doc.save(`${fileName}.pdf`);
    toast.success("PDF exported");
  } catch (err) {
    console.error(err);
    toast.error("PDF export needs: npm i jspdf jspdf-autotable");
  }
}

/* -------------------------- Print (with company) ------------------------- */
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildCompanyHeaderHtml(
  companySettings: CompanySettingsInfo | undefined,
  brandingSettings: BrandingSettingsInfo | undefined,
  title: string
) {
  const cs = companySettings;

  const name = escapeHtml(cs?.companyName || cs?.legalName || title);

  const addressParts = [
    cs?.addressLine1,
    cs?.addressLine2,
    [cs?.city, cs?.state].filter(Boolean).join(", "),
    [cs?.postalCode, cs?.country].filter(Boolean).join(" "),
  ]
    .filter((line) => !!line && line.trim().length)
    .map((l) => escapeHtml(l!));

  const contactParts = [
    cs?.phone ? `Tel: ${cs.phone}` : null,
    cs?.email ? `Email: ${cs.email}` : null,
    cs?.website ? `Web: ${cs.website}` : null,
  ]
    .filter(Boolean)
    .map((l) => escapeHtml(l!));

  const taxParts = [
    cs?.taxId ? `Tax ID: ${cs.taxId}` : null,
    cs?.registrationNumber ? `Reg No: ${cs.registrationNumber}` : null,
  ]
    .filter(Boolean)
    .map((l) => escapeHtml(l!));

  const logoHtml = brandingSettings?.darkLogoUrl
    ? `<div style="flex:0 0 auto;margin-left:24px;">
         <img src="${escapeHtml(brandingSettings.darkLogoUrl)}" style="max-height:40px;object-fit:contain;" />
       </div>`
    : "";

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
      <div>
        <h2 style="margin:0 0 4px 0;">${name}</h2>
        ${addressParts.length ? `<div style="font-size:10px;margin-bottom:4px;">${addressParts.join("<br/>")}</div>` : ""}
        ${contactParts.length ? `<div style="font-size:10px;margin-bottom:2px;">${contactParts.join(" &nbsp; ")}</div>` : ""}
        ${taxParts.length ? `<div style="font-size:10px;margin-bottom:6px;">${taxParts.join(" &nbsp; ")}</div>` : ""}
      </div>
      ${logoHtml}
    </div>
  `;
}

function printTable<T>(
  table: TanTable<T>,
  title = "Table",
  rows?: Row<T>[],
  companySettings?: CompanySettingsInfo,
  brandingSettings?: BrandingSettingsInfo
) {
  const cols = getPrintableColumns(table);
  const dataRows = rows ?? getSafeFilteredRows(table);
  if (!dataRows.length) return;

  const thStyle = 'style="text-align:left;padding:8px;border-bottom:1px solid #ddd"';
  const tdStyle = 'style="padding:6px 8px;border-bottom:1px solid #f2f2f2;vertical-align:top;"';

  const th =
    `<th ${thStyle}>No.</th>` +
    cols
      .map(
        (c) =>
          `<th ${thStyle}>${
            typeof c.columnDef.header === "string"
              ? escapeHtml(c.columnDef.header)
              : escapeHtml(c.id)
          }</th>`
      )
      .join("");

  const trs = dataRows
    .map((r, rowIndex) => {
      const noCell = `<td ${tdStyle}>${rowIndex + 1}</td>`;
      const tds = cols
        .map((c) => {
          const meta = (c.columnDef.meta || {}) as any;
          const raw =
            typeof meta.exportValue === "function"
              ? meta.exportValue(r.original)
              : r.getValue<any>(c.id);

          const s =
            raw == null
              ? ""
              : typeof raw === "object"
                ? JSON.stringify(raw)
                : String(raw);

          return `<td ${tdStyle}>${escapeHtml(s)}</td>`;
        })
        .join("");

      return `<tr>${noCell}${tds}</tr>`;
    })
    .join("");

  const w = window.open("", "_blank");
  if (!w) return;

  const headerHtml = buildCompanyHeaderHtml(companySettings, brandingSettings, title);

  w.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        ${headerHtml}
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead><tr>${th}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </body>
    </html>
  `);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

/* ----------------------- Pagination helpers ----------------------- */
function buildPageItems(current: number, totalPages: number, windowSize = 2) {
  const pages: (number | string)[] = [];
  if (totalPages <= 1) return [1];
  const start = Math.max(1, current - windowSize);
  const end = Math.min(totalPages, current + windowSize);

  pages.push(1);
  if (start > 2) pages.push("…");

  for (let p = start; p <= end; p++) {
    if (p !== 1 && p !== totalPages) pages.push(p);
  }

  if (end < totalPages - 1) pages.push("…");
  pages.push(totalPages);

  const out: (number | string)[] = [];
  for (const i of pages) {
    const last = out[out.length - 1];
    if (i === "…" && last === "…") continue;
    if (typeof i === "number" && typeof last === "number" && i === last) continue;
    out.push(i);
  }
  return out;
}

function scrollIntoViewIfNeeded(selector?: string | false) {
  if (!selector) return;
  try {
    const el = document.querySelector(selector) ?? document.body;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {}
}

/* --------------------------------- UI ---------------------------------- */
export function DataTable<TData, TValue>({
  columns,
  data = [],
  title,
  description,
  serverMode = false,
  totalEntries = 0,
  onQueryChange,
  searchColumnId,
  searchPlaceholder = "Search...",
  filters,
  onDeleteRows,
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  onRefresh,
  onReload,
  fileName = "export",
  className,
  scrollTo = "body",
  dateFilterColumnId,
  companySettings,
  brandingSettings,
  autoSelectFilteredRows = false,
  serverSearchDebounceMs = 350,
}: DataTableProps<TData, TValue>) {
  const manual = !!serverMode;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const [pageIndexState, setPageIndexState] = React.useState(0);
  const [pageSizeState, setPageSizeState] = React.useState(pageSize);

  const [busy, setBusy] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [searchValue, setSearchValue] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchValue, serverSearchDebounceMs);

  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const coreRow = React.useMemo(() => getCoreRowModel(), []);
  const filteredRow = React.useMemo(() => getFilteredRowModel(), []);
  const sortedRow = React.useMemo(() => (!manual ? getSortedRowModel() : undefined), [manual]);
  const pagedRow = React.useMemo(() => (!manual ? getPaginationRowModel() : undefined), [manual]);

  // client-only date filtering (server mode should be handled via query)
  const dateFilteredData = React.useMemo(() => {
    if (manual) return data;

    if (!dateFilterColumnId || (!dateFrom && !dateTo)) return data;

    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTsRaw = dateTo ? new Date(dateTo).getTime() : null;
    const toTs = toTsRaw != null ? toTsRaw + 24 * 60 * 60 * 1000 - 1 : null;

    if (!fromTs && !toTs) return data;

    return data.filter((row: any) => {
      const raw = row?.[dateFilterColumnId as keyof typeof row] as any;
      if (!raw) return false;

      const d =
        raw instanceof Date
          ? raw
          : typeof raw === "string" || typeof raw === "number"
            ? new Date(raw)
            : null;

      if (!d) return false;

      const t = d.getTime();
      if (Number.isNaN(t)) return false;

      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;

      return true;
    });
  }, [manual, data, dateFilterColumnId, dateFrom, dateTo]);

  async function withBusy<T>(fn: () => Promise<T> | T) {
    try {
      setBusy(true);
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  const table = useReactTable({
    data: dateFilteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: { pageIndex: pageIndexState, pageSize: pageSizeState },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: pageIndexState, pageSize: pageSizeState })
          : updater;

      setPageIndexState(next.pageIndex);
      setPageSizeState(next.pageSize);

      scrollIntoViewIfNeeded(scrollTo);
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: coreRow,
    getFilteredRowModel: filteredRow,
    ...(sortedRow ? { getSortedRowModel: sortedRow } : {}),
    ...(pagedRow ? { getPaginationRowModel: pagedRow } : {}),
    manualSorting: manual,
    manualPagination: manual,
    manualFiltering: false,
    initialState: !manual ? { pagination: { pageSize } } : undefined,
  });

  // ✅ server mode: single source of truth for query calls (debounced)
  React.useEffect(() => {
    if (!manual || !onQueryChange) return;

    const first = sorting[0];

    onQueryChange({
      page: pageIndexState + 1,
      pageSize: pageSizeState,
      sortCol: first?.id,
      sortDir: first?.desc ? "desc" : "asc",
      search: searchColumnId ? (debouncedSearch || "") : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manual,
    onQueryChange,
    pageIndexState,
    pageSizeState,
    sorting,
    debouncedSearch,
    searchColumnId,
    dateFrom,
    dateTo,
  ]);

  // ✅ optional: auto-select filtered rows when filters/search/date active
  React.useEffect(() => {
    if (!autoSelectFilteredRows) return;

    const hasColFilters = columnFilters.length > 0;
    const hasSearch = !!(
      searchColumnId &&
      (manual
        ? debouncedSearch
        : ((table.getColumn(searchColumnId)?.getFilterValue() as string) ?? ""))
    );
    const hasDate = !!(dateFrom || dateTo);

    if (!hasColFilters && !hasSearch && !hasDate) {
      table.resetRowSelection();
      return;
    }

    table.resetRowSelection();
    const rows = getSafeFilteredRows(table);
    rows.forEach((r) => r.toggleSelected(true));
  }, [
    autoSelectFilteredRows,
    columnFilters,
    manual,
    debouncedSearch,
    searchColumnId,
    dateFrom,
    dateTo,
    table,
  ]);

  const selectedRows = table.getSelectedRowModel().rows ?? [];
  const selectedCount = selectedRows.length;
  const hasSelection = selectedCount > 0;

  const refreshFn = onRefresh ?? onReload;

  const page = pageIndexState;
  const ps = pageSizeState;

  const clientTotal = table.getFilteredRowModel().rows.length;
  const total = manual ? totalEntries : clientTotal;
  const pageCount = Math.max(1, Math.ceil((total || 0) / (ps || 1)));

  const startEntry = total === 0 ? 0 : page * ps + 1;
  const endEntry = total === 0 ? 0 : Math.min((page + 1) * ps, total);

  const canPrev = manual ? page > 0 : table.getCanPreviousPage();
  const canNext = manual ? page + 1 < pageCount : table.getCanNextPage();

  const currentSearchVal = searchColumnId
    ? manual
      ? searchValue
      : ((table.getColumn(searchColumnId)?.getFilterValue() as string) ?? "")
    : "";

  const anyFilterOrSearch =
    columnFilters.length > 0 ||
    !!dateFrom ||
    !!dateTo ||
    (searchColumnId ? !!currentSearchVal : false);

  const isOverlayActive = refreshing || busy;

  const clearSearch = () => {
    if (!searchColumnId) return;
    if (manual) {
      setSearchValue("");
      setPageIndexState(0);
    } else {
      table.getColumn(searchColumnId)?.setFilterValue("");
      table.setPageIndex(0);
    }
  };

  function resetFiltersAndState() {
    setColumnFilters([]);
    setDateFrom("");
    setDateTo("");
    setSorting([]);
    table.resetRowSelection();

    if (searchColumnId) {
      if (manual) setSearchValue("");
      else table.getColumn(searchColumnId)?.setFilterValue("");
    }

    setPageIndexState(0);
  }

  async function handleRefresh() {
    resetFiltersAndState();
    if (!refreshFn) return;

    try {
      setRefreshing(true);
      await withBusy(async () => {
        await refreshFn();
      });
      toast.success("Table refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMultiDelete() {
    if (!onDeleteRows || !hasSelection) return;
    await withBusy(async () => {
      await onDeleteRows(selectedRows.map((r) => r.original as TData));
    });
    table.resetRowSelection();
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      <DataTableCard>
        {(title || description) && (
          <DataTableCardHeader>
            {title && <DataTableCardTitle>{title}</DataTableCardTitle>}
            {description && <DataTableCardDescription>{description}</DataTableCardDescription>}
          </DataTableCardHeader>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-4 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search */}
            {searchColumnId && (
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={currentSearchVal ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (manual) {
                      setSearchValue(val);
                      setPageIndexState(0);
                    } else {
                      table.getColumn(searchColumnId)?.setFilterValue(val);
                      table.setPageIndex(0);
                    }
                  }}
                  className="h-9 w-full pl-9"
                />
                {currentSearchVal && (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Date (client filters locally, server passes query) */}
            {!!dateFilterColumnId && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="h-9 w-[130px]"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPageIndexState(0);
                  }}
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="date"
                  className="h-9 w-[130px]"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPageIndexState(0);
                  }}
                />
              </div>
            )}

            {/* Faceted filters */}
            {filters?.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <Separator orientation="vertical" className="hidden h-6 sm:block" />
                {filters.map((filter) => {
                  const col = table.getColumn(filter.columnId);
                  const current = (col?.getFilterValue() as string) ?? "";

                  return (
                    <DropdownMenu key={filter.columnId}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full border-dashed">
                          <span className="font-normal">{filter.title}</span>
                          {current && (
                            <span className="ml-1 rounded-sm bg-primary/10 px-1 py-0.5 text-xs font-normal text-primary">
                              {filter.options.find((o) => o.value === current)?.label}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>{filter.title}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={!current}
                          onCheckedChange={() => {
                            col?.setFilterValue(undefined);
                            setPageIndexState(0);
                          }}
                        >
                          All
                        </DropdownMenuCheckboxItem>
                        {filter.options.map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt.value}
                            checked={current === opt.value}
                            onCheckedChange={() => {
                              col?.setFilterValue(opt.value);
                              setPageIndexState(0);
                            }}
                          >
                            {opt.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              </div>
            ) : null}

            {/* Reset */}
            {anyFilterOrSearch && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={resetFiltersAndState}
                title="Reset filters"
                aria-label="Reset filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              title="Refresh"
              className="h-9 w-9"
              disabled={refreshing || !refreshFn}
              aria-label="Refresh table"
            >
              <RotateCw className={cn("h-4 w-4", (refreshing || busy) && "animate-spin")} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2">
                  <ColumnsIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide() && !["seq", "select"].includes(column.id))
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      className="capitalize"
                    >
                      {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => withBusy(() => copyTableToClipboard(table))}
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Copy</span>
            </Button>

            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() =>
                withBusy(() => printTable(table, fileName, undefined, companySettings, brandingSettings))
              }
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="h-9 gap-2 shadow-sm">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => withBusy(() => downloadCsv(table, fileName))}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => withBusy(() => exportXlsx(table, fileName))}>
                  XLSX
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    withBusy(() => exportPdf(table, fileName, undefined, companySettings, brandingSettings))
                  }
                >
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <DataTableCardContent className="relative border-t">
          {isOverlayActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
              <RotateCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          <Table>
            <TableHeader className="bg-muted/30">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-b hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className={cn(
                        "h-10 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground",
                        h.column.getCanSort() && "cursor-pointer select-none hover:text-foreground",
                        (h.column.columnDef.meta as any)?.align === "right" && "text-right",
                        (h.column.columnDef.meta as any)?.align === "center" && "text-center"
                      )}
                      onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          (h.column.columnDef.meta as any)?.align === "right" && "justify-end",
                          (h.column.columnDef.meta as any)?.align === "center" && "justify-center"
                        )}
                      >
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc"
                          ? " ▲"
                          : h.column.getIsSorted() === "desc"
                            ? " ▼"
                            : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="group transition-colors hover:bg-muted/20 data-[state=selected]:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "px-4 py-3 align-middle text-sm",
                          (cell.column.columnDef.meta as any)?.align === "right" && "text-right",
                          (cell.column.columnDef.meta as any)?.align === "center" && "text-center"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllLeafColumns().length || 1}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableCardContent>

        {/* Footer / pagination */}
        <DataTableCardFooter className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <select
              className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs font-medium"
              value={pageSizeState}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPageSizeState(val);
                setPageIndexState(0);
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">
              Showing <strong>{startEntry}</strong>-<strong>{endEntry}</strong> of <strong>{total}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setPageIndexState((p) => Math.max(0, p - 1));
                scrollIntoViewIfNeeded(scrollTo);
              }}
              disabled={!canPrev}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {buildPageItems(page + 1, pageCount, 1).map((item, idx) => {
              if (item === "…") {
                return (
                  <span key={`dots-${idx}`} className="px-2 text-xs text-muted-foreground">
                    ...
                  </span>
                );
              }

              const pNum = item as number;
              const isActive = pNum === page + 1;

              return (
                <Button
                  key={`p-${pNum}`}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8 w-8 p-0 text-xs", isActive && "pointer-events-none")}
                  onClick={() => {
                    setPageIndexState(pNum - 1);
                    scrollIntoViewIfNeeded(scrollTo);
                  }}
                >
                  {pNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setPageIndexState((p) => Math.min(pageCount - 1, p + 1));
                scrollIntoViewIfNeeded(scrollTo);
              }}
              disabled={!canNext}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DataTableCardFooter>
      </DataTableCard>

      {/* Floating selection bar */}
      {hasSelection && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-900 p-2 pl-4 text-zinc-50 shadow-2xl dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            <div className="flex items-center gap-2 border-r border-white/20 pr-3 dark:border-black/20">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {selectedCount}
              </span>
              <span className="text-sm font-medium">Selected</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full px-3 text-white hover:bg-white/20 dark:text-black dark:hover:bg-black/10"
                onClick={() => withBusy(() => copyTableToClipboard(table, selectedRows))}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full px-3 text-white hover:bg-white/20 dark:text-black dark:hover:bg-black/10"
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onClick={() => withBusy(() => downloadCsv(table, fileName, selectedRows))}>
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => withBusy(() => exportXlsx(table, fileName, selectedRows))}>
                    XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      withBusy(() => exportPdf(table, fileName, selectedRows, companySettings, brandingSettings))
                    }
                  >
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full px-3 text-white hover:bg-white/20 dark:text-black dark:hover:bg-black/10"
                onClick={() =>
                  withBusy(() => printTable(table, fileName, selectedRows, companySettings, brandingSettings))
                }
              >
                <Printer className="mr-2 h-3.5 w-3.5" />
                Print
              </Button>

              {onDeleteRows && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full px-3 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                  onClick={handleMultiDelete}
                  disabled={busy}
                >
                  <X className="mr-2 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-zinc-400 hover:bg-white/20 hover:text-white dark:hover:bg-black/10 dark:hover:text-black"
              onClick={() => table.resetRowSelection()}
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
