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
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDetailHref } from "@/hooks/use-detail-param";
import { useNow } from "@/hooks/use-now";
import { DASH, formatDuration, formatRelative, formatSource, formatUsd } from "@/lib/format";
import { CHANNEL, SOURCE_TYPE, TASK_STATUS } from "@/lib/labels";
import type { Channel, RecognitionListItem, SourceType, TaskStatus } from "@/lib/ops-types";
import { cn } from "@/lib/utils";
import { SOURCE_ICON, SourceCover, Thumb } from "./recognition-thumb";
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
      header: "Source",
      cell: ({ row: { original: item } }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Thumb url={item.thumbnail_url} icon={SOURCE_ICON[item.source_type]} className="size-12" />
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
      header: "Channel",
      filterFn: "equals",
      cell: ({ row }) => <span className="whitespace-nowrap">{CHANNEL[row.original.channel]}</span>,
    },
    {
      accessorKey: "source_type",
      header: "Type",
      filterFn: "equals",
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      filterFn: (row, _id, value: TaskStatus[]) => value.includes(row.original.status),
      cell: ({ row: { original: item } }) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={TASK_STATUS[item.status].variant}>{TASK_STATUS[item.status].label}</Badge>
          {item.runs > 1 && <span className="text-xs text-muted-foreground">{item.runs} attempts</span>}
        </div>
      ),
    },
    {
      accessorKey: "places_count",
      header: ({ column }) => (
        <SortButton label="Places" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      cell: ({ row }) => <PlacesCell item={row.original} />,
    },
    {
      accessorKey: "total_ms",
      header: ({ column }) => (
        <SortButton label="Duration" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      sortUndefined: "last",
      cell: ({ row }) => <span className="tabular-nums">{formatDuration(row.original.total_ms)}</span>,
    },
    {
      accessorKey: "cost_usd",
      header: ({ column }) => (
        <SortButton label="Cost" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      sortUndefined: "last",
      cell: ({ row }) => <span className="tabular-nums">{formatUsd(row.original.cost_usd)}</span>,
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <SortButton label="When" sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
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
  const href = useDetailHref();
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
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="open">Running</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={filterValue("source_type")} onValueChange={(value) => setFilter("source_type", value)}>
          <SelectTrigger size="sm" className="w-36" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(SOURCE_TYPE) as SourceType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {SOURCE_TYPE[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterValue("channel")} onValueChange={(value) => setFilter("channel", value)}>
          <SelectTrigger size="sm" className="w-40" aria-label="Channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
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
          aria-label="View"
        >
          <ToggleGroupItem value="table" aria-label="Table">
            <Rows3 />
          </ToggleGroupItem>
          <ToggleGroupItem value="gallery" aria-label="Gallery">
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No recognitions match these filters" description="Widen the filters or change the range." />
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
                aria-label={`Open ${SOURCE_TYPE[row.original.source_type]} details`}
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
        <RecognitionGallery items={rows.map((row) => row.original)} href={href} now={now} />
      )}

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{filteredCount} recognitions</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {table.state.pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Covers first: what was shared is recognisable at a glance. Each cover links to its detail. */
export function RecognitionGallery({
  items,
  href,
  now,
  className,
}: {
  items: RecognitionListItem[];
  href: (id: string) => string;
  now: number;
  className?: string;
}) {
  return (
    <ItemGroup className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {items.map((item) => (
        <Item key={item.id} asChild role="listitem" className="group/cover gap-2 p-1.5 hover:bg-muted">
          <Link href={href(item.id)} scroll={false}>
            <ItemHeader className="relative">
              <SourceCover
                url={item.thumbnail_url}
                type={item.source_type}
                sizes="(min-width: 1024px) 20vw, 45vw"
                className="w-full transition-transform duration-200 ease-out group-hover/cover:scale-[1.02] motion-reduce:transition-none"
              />
              <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
                <Badge className="bg-card/90 text-foreground">{SOURCE_TYPE[item.source_type]}</Badge>
                <Badge variant={TASK_STATUS[item.status].variant} className="bg-card/90">
                  {TASK_STATUS[item.status].label}
                </Badge>
              </div>
            </ItemHeader>
            <ItemContent className="min-w-0 gap-0.5 px-0.5">
              <ItemTitle className="block w-full truncate">
                {item.place_names?.length ? item.place_names.join(", ") : item.status === "completed" ? "No places found" : DASH}
              </ItemTitle>
              <ItemDescription className="line-clamp-1 text-xs tabular-nums">
                {CHANNEL[item.channel]} · {formatDuration(item.total_ms)} · {formatRelative(item.created_at, now)}
              </ItemDescription>
            </ItemContent>
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}
