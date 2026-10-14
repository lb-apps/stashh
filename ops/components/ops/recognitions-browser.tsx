"use client";

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { DASH, formatDuration, formatRelative, formatSource, formatUsd } from "@/lib/format";
import { CHANNEL, SOURCE_TYPE, TASK_STATUS } from "@/lib/labels";
import type { Channel, RecognitionListItem, SourceType, TaskStatus } from "@/lib/ops-types";
import { cn } from "@/lib/utils";
import { RecognitionThumb } from "./recognition-thumb";
import { EmptyState } from "./states";

type StatusTab = "all" | "done" | "failed" | "open";

// Module scope: a features object rebuilt on every render would invalidate the row models.
const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns,
  sortFns,
});

const STATUS_GROUP: Record<Exclude<StatusTab, "all">, TaskStatus[]> = {
  done: ["completed", "committed"],
  failed: ["failed", "cancelled", "expired"],
  open: ["queued", "processing"],
};

function SortButton({ label, sorted, onClick }: { label: string; sorted: false | "asc" | "desc"; onClick: () => void }) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" onClick={onClick}>
      {label}
      <Icon aria-hidden className="size-3.5" />
    </Button>
  );
}

function PlacesCell({ item }: { item: RecognitionListItem }) {
  if (item.places_count === 0) return <span className="text-muted-foreground">{item.status === "completed" ? "0" : DASH}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default font-medium underline decoration-dotted underline-offset-4" tabIndex={0}>
          {item.places_count}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{item.place_names?.join(", ")}</TooltipContent>
    </Tooltip>
  );
}

function useColumns(now: number): ColumnDef<typeof features, RecognitionListItem>[] {
  return [
    {
      id: "source",
      header: "Kaynak",
      cell: ({ row: { original: item } }) => (
        <div className="flex min-w-0 items-center gap-3">
          <RecognitionThumb url={item.thumbnail_url} type={item.source_type} className="size-12" sizes="48px" />
          <div className="grid min-w-0 gap-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="info">{SOURCE_TYPE[item.source_type]}</Badge>
              <span className="truncate font-mono text-xs text-muted-foreground">{formatSource(item.source_url)}</span>
            </div>
            <p className="line-clamp-1 max-w-80 text-sm">{item.caption ?? item.error_message ?? DASH}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "channel",
      header: "Kanal",
      filterFn: "equals",
      cell: ({ row }) => <span className="whitespace-nowrap">{CHANNEL[row.original.channel]}</span>,
    },
    {
      accessorKey: "source_type",
      header: "Tür",
      filterFn: "equals",
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: "Durum",
      filterFn: (row, _id, value: TaskStatus[]) => value.includes(row.original.status),
      cell: ({ row: { original: item } }) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={TASK_STATUS[item.status].variant}>{TASK_STATUS[item.status].label}</Badge>
          {item.runs > 1 && <span className="text-xs text-muted-foreground">{item.runs} deneme</span>}
        </div>
      ),
    },
    {
      accessorKey: "places_count",
      header: ({ column }) => (
        <SortButton label="Mekân" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      cell: ({ row }) => <PlacesCell item={row.original} />,
    },
    {
      accessorKey: "total_ms",
      header: ({ column }) => (
        <SortButton label="Süre" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      sortUndefined: "last",
      cell: ({ row }) => <span className="tabular-nums">{formatDuration(row.original.total_ms)}</span>,
    },
    {
      accessorKey: "cost_usd",
      header: ({ column }) => (
        <SortButton label="Maliyet" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      sortUndefined: "last",
      cell: ({ row }) => <span className="tabular-nums">{formatUsd(row.original.cost_usd)}</span>,
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <SortButton label="Zaman" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatRelative(row.original.created_at, now)}</span>,
    },
  ];
}

/**
 * Every recognition, as a table or a gallery of covers: filter by status, type and
 * channel, sort, page through, and open one for its full story.
 */
export function RecognitionsBrowser({
  items,
  onOpen,
  pageSize = 10,
}: {
  items: RecognitionListItem[];
  onOpen: (id: string) => void;
  pageSize?: number;
}) {
  const now = useNow();
  const columns = useColumns(now);
  const [view, setView] = useState<"table" | "gallery">("table");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useTable({
    features,
    data: items,
    columns,
    state: {
      sorting,
      columnFilters: statusTab === "all" ? columnFilters : [...columnFilters, { id: "status", value: STATUS_GROUP[statusTab] }],
      columnVisibility: { source_type: false },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    initialState: { pagination: { pageIndex: 0, pageSize } },
    getRowId: (row) => row.id,
  });

  const setFilter = (id: "source_type" | "channel", value: string) =>
    setColumnFilters((current) => [...current.filter((f) => f.id !== id), ...(value === "all" ? [] : [{ id, value }])]);
  const filterValue = (id: string) => (columnFilters.find((f) => f.id === id)?.value as string | undefined) ?? "all";
  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={statusTab} onValueChange={(value) => { setStatusTab(value as StatusTab); table.setPageIndex(0); }}>
          <TabsList>
            <TabsTrigger value="all">Tümü</TabsTrigger>
            <TabsTrigger value="done">Tamamlanan</TabsTrigger>
            <TabsTrigger value="failed">Başarısız</TabsTrigger>
            <TabsTrigger value="open">Süren</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={filterValue("source_type")} onValueChange={(value) => setFilter("source_type", value)}>
          <SelectTrigger size="sm" className="w-36" aria-label="Tür">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm türler</SelectItem>
            {(Object.keys(SOURCE_TYPE) as SourceType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {SOURCE_TYPE[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterValue("channel")} onValueChange={(value) => setFilter("channel", value)}>
          <SelectTrigger size="sm" className="w-40" aria-label="Kanal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kanallar</SelectItem>
            {(Object.keys(CHANNEL) as Channel[]).map((channel) => (
              <SelectItem key={channel} value={channel}>
                {CHANNEL[channel]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(value) => value && setView(value as "table" | "gallery")}
          className="ml-auto"
          aria-label="Görünüm"
        >
          <ToggleGroupItem value="table" aria-label="Tablo">
            <Rows3 />
          </ToggleGroupItem>
          <ToggleGroupItem value="gallery" aria-label="Galeri">
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Bu filtrelere uyan tanıma yok" description="Filtreleri genişlet ya da aralığı değiştir." />
      ) : view === "table" ? (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                aria-label={`${SOURCE_TYPE[row.original.source_type]} ayrıntısını aç`}
                className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
                onClick={() => onOpen(row.original.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(row.original.id);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <RecognitionGallery items={rows.map((row) => row.original)} onOpen={onOpen} now={now} />
      )}

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{filteredCount} tanıma</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {table.state.pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Önceki sayfa">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Sonraki sayfa">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Covers first: what was shared is recognisable at a glance. */
export function RecognitionGallery({
  items,
  onOpen,
  now,
  className,
}: {
  items: RecognitionListItem[];
  onOpen: (id: string) => void;
  now: number;
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="group grid w-full gap-2 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="relative">
              <RecognitionThumb
                url={item.thumbnail_url}
                type={item.source_type}
                className="aspect-[4/5] w-full rounded-xl transition-transform duration-200 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
                sizes="(min-width: 1024px) 20vw, 45vw"
              />
              <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
                <Badge className="bg-card/90 text-foreground">{SOURCE_TYPE[item.source_type]}</Badge>
                <Badge variant={TASK_STATUS[item.status].variant} className="bg-card/90">
                  {TASK_STATUS[item.status].label}
                </Badge>
              </div>
            </div>
            <div className="grid gap-0.5 px-0.5">
              <p className="line-clamp-1 text-sm font-medium">
                {item.place_names?.length ? item.place_names.join(", ") : item.status === "completed" ? "Mekân bulunamadı" : DASH}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {CHANNEL[item.channel]} · {formatDuration(item.total_ms)} · {formatRelative(item.created_at, now)}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
