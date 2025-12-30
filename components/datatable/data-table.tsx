// components/datatable/data-table.tsx
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
  Trash2,
  X,
} from "lucide-react";
import {
  ColumnDef,
  Row,
  RowSelectionState,
  SortingState,
  Table as TanTable,
  VisibilityState,
  flexRender,
  getCoreRowModel,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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

/* ---------------------------- clipboard/export helpers ---------------------------- */
function toClipboardTable<T>(table: TanTable<T>, rows?: Row<T>[]) {
  const cols = getExportableColumns(table);
  const dataRows = rows ?? table.getRowModel().rows;

  const header = [
    "No.",
    ...cols.map((c) => (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)),
  ].join("\t");

  const lines = dataRows.map((r, rowIndex) =>
    [
      String(rowIndex + 1),
      ...cols.map((c) => {
        const meta = (c.columnDef.meta || {}) as any;
        const raw =
          typeof meta.exportValue === "function" ? meta.exportValue(r.original) : r.getValue<any>(c.id);
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
  const dataRows = rows ?? table.getRowModel().rows;

  const header = [
    "No.",
    ...cols.map((c) => (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)),
  ].join(",");

  const lines = dataRows.map((r, rowIndex) =>
    [
      String(rowIndex + 1),
      ...cols.map((c) => {
        const meta = (c.columnDef.meta || {}) as any;
        const raw =
          typeof meta.exportValue === "function" ? meta.exportValue(r.original) : r.getValue<any>(c.id);

        const s = raw == null ? "" : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
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
    const dataRows = rows ?? table.getRowModel().rows;

    const data = dataRows.map((r, idx) => {
      const rowObj: Record<string, any> = { "No.": idx + 1 };
      cols.forEach((c) => {
        const header = typeof c.columnDef.header === "string" ? c.columnDef.header : c.id;
        const meta = (c.columnDef.meta || {}) as any;
        const val = typeof meta.exportValue === "function" ? meta.exportValue(r.original) : r.getValue(c.id);
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

/* ------------------------ PDF export (with company) ------------------------ */
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
    const rows = rowsArg ?? table.getRowModel().rows;
    if (!rows.length) return;

    const head = [
      [
        "No.",
        ...cols.map((c) => (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)),
      ],
    ];

    const body = rows.map((r, rowIndex) => [
      String(rowIndex + 1),
      ...cols.map((c) => {
        const meta = (c.columnDef.meta || {}) as any;
        const raw =
          typeof meta.exportValue === "function" ? meta.exportValue(r.original) : r.getValue<any>(c.id);

        if (raw == null) return "";
        return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      }),
    ]);

    const doc = new JsPDFCtor({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // ---------- DARK LOGO (branding) ----------
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

    // ---------- COMPANY HEADER ----------
    const cs = companySettings;
    let y = headerTop;

    if (cs?.companyName || cs?.legalName) {
      doc.setFontSize(13);
      doc.text(cs.companyName || cs.legalName || fileName.toUpperCase(), 14, y);
      y += 6;
      if (cs.legalName && cs.legalName !== cs.companyName) {
        doc.setFontSize(10);
        doc.text(cs.legalName, 14, y);
        y += 5;
      }
    } else {
      doc.setFontSize(12);
      doc.text(fileName.toUpperCase(), 14, y);
      y += 6;
    }

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

    const headerRow = head[0] as string[];
    const columnStyles: Record<number, any> = {};
    headerRow.forEach((label, idx) => {
      if (label === "No.") columnStyles[idx] = { cellWidth: 10 };
      if (label === "Permissions") columnStyles[idx] = { cellWidth: 80 };
    });

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
      columnStyles,
    });

    doc.save(`${fileName}.pdf`);
  } catch (err) {
    console.error(err);
    toast.error("PDF export needs: npm i jspdf jspdf-autotable");
  }
}

/* -------------------------- Print (with company) ------------------------- */
function buildCompanyHeaderHtml(
  companySettings: CompanySettingsInfo | undefined,
  brandingSettings: BrandingSettingsInfo | undefined,
  title: string
) {
  const cs = companySettings;
  const lines: string[] = [];

  const name = cs?.companyName || cs?.legalName || title;
  lines.push(`<h2 style="margin:0 0 4px 0;">${name}</h2>`);

  if (cs?.legalName && cs.legalName !== cs.companyName) {
    lines.push(`<div style="font-size:11px;margin-bottom:4px;">${cs.legalName}</div>`);
  }

  const addressParts = [
    cs?.addressLine1,
    cs?.addressLine2,
    [cs?.city, cs?.state].filter(Boolean).join(", "),
    [cs?.postalCode, cs?.country].filter(Boolean).join(" "),
  ].filter((line) => !!line && line.trim().length);

  if (addressParts.length) {
    lines.push(
      `<div style="font-size:10px;margin-bottom:2px;">${addressParts.map((l) => l!).join("<br/>")}</div>`
    );
  }

  const contactParts = [
    cs?.phone ? `Tel: ${cs.phone}` : null,
    cs?.email ? `Email: ${cs.email}` : null,
    cs?.website ? `Web: ${cs.website}` : null,
  ].filter(Boolean);

  if (contactParts.length) {
    lines.push(`<div style="font-size:10px;margin-bottom:2px;">${contactParts.join(" &nbsp; ")}</div>`);
  }

  const taxParts = [
    cs?.taxId ? `Tax ID: ${cs.taxId}` : null,
    cs?.registrationNumber ? `Reg No: ${cs.registrationNumber}` : null,
  ].filter(Boolean);

  if (taxParts.length) {
    lines.push(`<div style="font-size:10px;margin-bottom:6px;">${taxParts.join(" &nbsp; ")}</div>`);
  }

  const textHtml = lines.join("");

  const logoHtml = brandingSettings?.darkLogoUrl
    ? `<div style="flex:0 0 auto;margin-left:24px;">
         <img src="${brandingSettings.darkLogoUrl}" style="max-height:40px;object-fit:contain;" />
       </div>`
    : "";

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
      <div>${textHtml}</div>
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
  const dataRows = rows ?? table.getRowModel().rows;
  if (!dataRows.length) return;

  const thStyle = 'style="text-align:left;padding:8px;border-bottom:1px solid #ddd"';
  const tdStyle = 'style="padding:6px 8px;border-bottom:1px solid #f2f2f2;vertical-align:top;"';

  const th =
    `<th ${thStyle}>No.</th>` +
    cols
      .map((c) => `<th ${thStyle}>${typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}</th>`)
      .join("");

  const trs = dataRows
    .map((r, rowIndex) => {
      const noCell = `<td ${tdStyle}>${rowIndex + 1}</td>`;
      const tds = cols
        .map((c) => {
          const meta = (c.columnDef.meta || {}) as any;
          const raw =
            typeof meta.exportValue === "function" ? meta.exportValue(r.original) : r.getValue<any>(c.id);
          const s = raw == null ? "" : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
          return `<td ${tdStyle}>${s.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</td>`;
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
      <head><title>${title}</title></head>
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

/* ---------------------------- pagination range ---------------------------- */
type PageItem = number | "…";

function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: PageItem[] = [];
  const push = (x: PageItem) => items.push(x);

  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  push(1);

  if (left > 2) push("…");
  for (let p = left; p <= right; p++) push(p);
  if (right < total - 1) push("…");

  push(total);

  return items;
}

/* ------------------------------------------------------------------ */
/* ✅ SERVER MODE TABLE (controlled, NO AUTO-FETCH LOOP)               */
/* + Floating selection bar (Copy / Export / Print / Delete / Clear)   */
/* ------------------------------------------------------------------ */

type ServerTableQuery = {
  page: number; // 1-indexed
  pageSize: number;
  sortCol?: string;
  sortDir?: "asc" | "desc";
  search?: string;
};

type SelectionChangePayload<TData> = {
  selectedRowIds: RowSelectionState;
  selectedRowsOnPage: TData[];
  selectedCountOnPage: number;
};

export function DataTable<TData, TValue>({
  columns,
  data = [],
  totalEntries = 0,
  loading = false,

  pageIndex = 1, // 1-indexed
  pageSize = 5,
  pageSizeOptions = [5, 10, 15, 25, 50, 100, 200],

  onQueryChange,

  title = "Table",
  description,
  searchPlaceholder = "Search...",
  fileName = "export",
  serverSearchDebounceMs = 400,
  className,

  enableRowSelection = false,
  getRowId,
  selectedRowIds: controlledRowSelection,
  onSelectionChange,

  onDeleteRows,

  companySettings,
  brandingSettings,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalEntries: number;
  loading: boolean;

  pageIndex: number; // 1-indexed
  pageSize: number;
  pageSizeOptions?: number[];

  onQueryChange: (q: Partial<ServerTableQuery>) => void;

  title?: string;
  description?: string;
  searchPlaceholder?: string;
  fileName?: string;
  serverSearchDebounceMs?: number;
  className?: string;

  enableRowSelection?: boolean;
  getRowId?: (originalRow: TData, index: number) => string;
  selectedRowIds?: RowSelectionState; // controlled (optional)
  onSelectionChange?: (payload: SelectionChangePayload<TData>) => void;

  onDeleteRows?: (rows: TData[]) => Promise<void> | void;

  companySettings?: CompanySettingsInfo;
  brandingSettings?: BrandingSettingsInfo;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [searchValue, setSearchValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // selection (uncontrolled fallback)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const effectiveRowSelection = controlledRowSelection ?? rowSelection;

  const debouncedSearch = useDebouncedValue(searchValue, serverSearchDebounceMs);

  const pageIndex0 = Math.max(0, (pageIndex ?? 1) - 1);
  const pageCount = Math.max(1, Math.ceil((totalEntries || 0) / (pageSize || 1)));

  async function withBusy<T>(fn: () => Promise<T> | T) {
    try {
      setBusy(true);
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  // Inject a selection column when enabled
  const selectionColumn = React.useMemo<ColumnDef<TData, TValue>>(
    () => ({
      id: "select",
      enableSorting: false,
      enableHiding: false,
      size: 40,
      header: ({ table }) => {
        const hasRows = table.getRowModel().rows.length > 0;
        const isAll = hasRows && table.getIsAllPageRowsSelected();
        const isSome = hasRows && table.getIsSomePageRowsSelected();

        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAll ? true : isSome ? "indeterminate" : false}
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              aria-label="Select all rows on this page"
            />
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />
        </div>
      ),
      meta: { exportable: false, printable: false, align: "center" },
    }),
    []
  );

  const mergedColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns;
    const hasSelectAlready = columns.some((c: any) => c?.id === "select");
    if (hasSelectAlready) return columns;
    return [selectionColumn as any, ...columns];
  }, [columns, enableRowSelection, selectionColumn]);

  const table = useReactTable({
    data,
    columns: mergedColumns,
    state: {
      sorting,
      columnVisibility,
      rowSelection: enableRowSelection ? effectiveRowSelection : {},
      pagination: { pageIndex: pageIndex0, pageSize },
    },

    onSortingChange: (next) => {
      setSorting(next);
      const first = (Array.isArray(next) ? next[0] : undefined) as any;
      onQueryChange({
        page: 1,
        sortCol: first?.id,
        sortDir: first ? (first.desc ? "desc" : "asc") : undefined,
      });
    },

    onColumnVisibilityChange: setColumnVisibility,

    enableRowSelection: enableRowSelection,
    onRowSelectionChange: enableRowSelection
      ? (updater) => {
          const next =
            typeof updater === "function" ? (updater as any)(effectiveRowSelection) : (updater as RowSelectionState);

          const selectedRowsOnPage = table
            .getRowModel()
            .rows.filter((r) => !!next[r.id])
            .map((r) => r.original);

          if (controlledRowSelection) {
            onSelectionChange?.({
              selectedRowIds: next,
              selectedRowsOnPage,
              selectedCountOnPage: selectedRowsOnPage.length,
            });
          } else {
            setRowSelection(next);
            onSelectionChange?.({
              selectedRowIds: next,
              selectedRowsOnPage,
              selectedCountOnPage: selectedRowsOnPage.length,
            });
          }
        }
      : undefined,

    getRowId:
      getRowId ??
      ((row: TData, index: number) => {
        const anyRow = row as any;
        return String(anyRow?.id ?? anyRow?.uuid ?? anyRow?.key ?? index);
      }),

    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount,
  });

  // ✅ only search triggers query change
  React.useEffect(() => {
    onQueryChange({
      page: 1,
      search: debouncedSearch?.trim() ? debouncedSearch.trim() : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const canPrev = pageIndex0 > 0;
  const canNext = pageIndex0 + 1 < pageCount;

  const currentPage = pageIndex0 + 1;
  const pageItems = React.useMemo(() => buildPageItems(currentPage, pageCount), [currentPage, pageCount]);

  const sendPage = (page: number) => {
    const safe = Math.max(1, Math.min(pageCount, page));
    onQueryChange({ page: safe });
  };

  const sendPageSize = (nextSize: number) => {
    onQueryChange({ page: 1, pageSize: nextSize });
  };

  // Selection helpers (page-only)
  const selectedRowsOnPage = enableRowSelection ? table.getSelectedRowModel().rows : [];
  const selectedCount = selectedRowsOnPage.length;
  const hasSelection = enableRowSelection && selectedCount > 0;

  const clearSelection = () => {
    if (!enableRowSelection) return;
    if (controlledRowSelection) {
      onSelectionChange?.({ selectedRowIds: {}, selectedRowsOnPage: [], selectedCountOnPage: 0 });
      return;
    }
    setRowSelection({});
    onSelectionChange?.({ selectedRowIds: {}, selectedRowsOnPage: [], selectedCountOnPage: 0 });
  };

  const exportRows = selectedCount ? selectedRowsOnPage : undefined;

  // ✅ IMPORTANT: do NOT confirm/toast/auto-clear here.
  // Caller decides (your bulk dialog), and selection stays until you clear it.
  const handleDeleteSelected = async () => {
    if (!onDeleteRows || !selectedRowsOnPage.length) return;
    await withBusy(async () => {
      await onDeleteRows(selectedRowsOnPage.map((r) => r.original as TData));
    });
  };

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
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="h-9 w-full pl-9"
              />
              {!!searchValue && (
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchValue("")}
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            {/* Columns */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2">
                  <ColumnsIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide() && !["seq", "select"].includes(c.id))
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(!!v)}
                      className="capitalize"
                    >
                      {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onQueryChange({})}
              disabled={loading || busy}
              aria-label="Reload"
              title="Reload"
            >
              <RotateCw className={cn("h-4 w-4", (loading || busy) && "animate-spin")} />
            </Button>

            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => withBusy(() => copyTableToClipboard(table, exportRows))}
              disabled={loading || busy}
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">{selectedCount ? "Copy Selected" : "Copy"}</span>
            </Button>

            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => withBusy(() => printTable(table, title, exportRows, companySettings, brandingSettings))}
              disabled={loading || busy}
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{selectedCount ? "Print Selected" : "Print"}</span>
            </Button>

            {/* ✅ Export dropdown includes PDF */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="h-9 gap-2 shadow-sm" disabled={loading || busy}>
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">{selectedCount ? "Export Selected" : "Export"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadCsv(table, fileName, exportRows)}>
                  CSV{selectedCount ? " (selected)" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportXlsx(table, fileName, exportRows)}>
                  XLSX{selectedCount ? " (selected)" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    withBusy(() => exportPdf(table, fileName, exportRows, companySettings, brandingSettings))
                  }
                >
                  PDF{selectedCount ? " (selected)" : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <DataTableCardContent className="relative border-t">
          {(loading || busy) && (
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
                        (h.column.columnDef.meta as any)?.align === "center" && "text-center",
                        h.column.id === "select" && "w-[44px] px-2"
                      )}
                      onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          (h.column.columnDef.meta as any)?.align === "right" && "justify-end",
                          (h.column.columnDef.meta as any)?.align === "center" && "justify-center",
                          h.column.id === "select" && "justify-center"
                        )}
                      >
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? " ▲" : h.column.getIsSorted() === "desc" ? " ▼" : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {table.getAllLeafColumns().map((c) => (
                      <TableCell key={`sk-${i}-${c.id}`} className={cn("px-4 py-3", c.id === "select" && "px-2")}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "group transition-colors hover:bg-muted/20",
                      enableRowSelection && row.getIsSelected() && "bg-muted/10"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "px-4 py-3 align-middle text-sm",
                          (cell.column.columnDef.meta as any)?.align === "right" && "text-right",
                          (cell.column.columnDef.meta as any)?.align === "center" && "text-center",
                          cell.column.id === "select" && "px-2"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllLeafColumns().length || 1} className="h-32 text-center text-sm text-muted-foreground">
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
              className="h-9 w-20 rounded-xl border border-input bg-background px-2 text-xs font-medium"
              value={pageSize}
              onChange={(e) => sendPageSize(Number(e.target.value))}
              disabled={loading || busy}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">
              Total <strong>{totalEntries.toLocaleString()}</strong>
            </span>

            {hasSelection && (
              <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">
                Selected (page) <strong>{selectedCount}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn("h-12 w-12 rounded-2xl border bg-background/40 p-0", (!canPrev || loading || busy) && "opacity-50")}
              onClick={() => sendPage(currentPage - 1)}
              disabled={!canPrev || loading || busy}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2">
              {pageItems.map((item, idx) => {
                if (item === "…") {
                  return (
                    <div key={`dots-${idx}`} className="px-2 text-sm text-muted-foreground">
                      …
                    </div>
                  );
                }

                const isActive = item === currentPage;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => sendPage(item)}
                    disabled={loading || busy}
                    className={cn(
                      "h-12 w-12 rounded-2xl border text-sm font-semibold transition",
                      isActive
                        ? "border-transparent bg-white text-black"
                        : "border-border/60 bg-background/40 text-foreground hover:bg-background/70",
                      (loading || busy) && "opacity-60"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              className={cn("h-12 w-12 rounded-2xl border bg-background/40 p-0", (!canNext || loading || busy) && "opacity-50")}
              onClick={() => sendPage(currentPage + 1)}
              disabled={!canNext || loading || busy}
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </DataTableCardFooter>
      </DataTableCard>

      {/* ✅ Floating selection bar (Copy / Export / Print / Delete / Clear) */}
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
                onClick={() => withBusy(() => copyTableToClipboard(table, selectedRowsOnPage))}
                disabled={loading || busy}
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
                    disabled={loading || busy}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onClick={() => downloadCsv(table, fileName, selectedRowsOnPage)}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportXlsx(table, fileName, selectedRowsOnPage)}>XLSX</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      withBusy(() =>
                        exportPdf(table, fileName, selectedRowsOnPage, companySettings, brandingSettings)
                      )
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
                onClick={() => withBusy(() => printTable(table, title, selectedRowsOnPage, companySettings, brandingSettings))}
                disabled={loading || busy}
              >
                <Printer className="mr-2 h-3.5 w-3.5" />
                Print
              </Button>

              {onDeleteRows && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full px-3 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                  onClick={handleDeleteSelected}
                  disabled={loading || busy}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-zinc-400 hover:bg-white/20 hover:text-white dark:hover:bg-black/10 dark:hover:text-black"
              onClick={clearSelection}
              disabled={loading || busy}
              aria-label="Clear selection"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
