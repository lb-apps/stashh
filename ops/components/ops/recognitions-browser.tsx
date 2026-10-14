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
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, LayoutGrid, Rows3, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDetailHref } from "@/hooks/use-detail-param";
import { useNow } from "@/hooks/use-now";
import { DASH, formatDuration, formatInt, formatRelative, formatSource, formatUsd } from "@/lib/format";
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

/** Free-text match on what a person would remember: the link, the caption, a place. */
function matches(item: RecognitionListItem, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("tr");
  if (!q) return true;
  return [item.source_url, item.caption, ...(item.place_names ?? [])].some((text) => text?.toLocaleLowerCase("tr").includes(q));
}

function SortButton({ label, sorted, onClick }: { label: string; sorted: false | "asc" | "desc"; onClick: () => void }) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Button variant="ghost" size="xs" className="micro-label -ml-2.5 hover:text-foreground" onClick={onClick}>
      {label}
      <Icon aria-hidden />
    </Button>
  );
}

function PlacesCell({ item }: { item: RecognitionListItem }) {
  const count = <span className="numeric text-headline font-black">{item.status === "completed" || item.places_count > 0 ? item.places_count : DASH}</span>;
  if (item.places_count === 0) return count;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default rounded-tile" tabIndex={0}>
          {count}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{item.place_names?.join(", ")}</TooltipContent>
    </Tooltip>
  );
}

function sortable(label: string): ColumnDef<typeof features, RecognitionListItem>["header"] {
  return function SortableHeader({ column }) {
    return <SortButton label={label} sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />;
  };
}

function useColumns(now: number): ColumnDef<typeof features, RecognitionListItem>[] {
  return [
    {
      id: "source",
      header: "Source",
      cell: ({ row: { original: item } }) => (
        <div className="flex min-w-56 items-center gap-3">
          <Thumb url={item.thumbnail_url} icon={SOURCE_ICON[item.source_type]} className="size-11" />
          <div className="grid min-w-0 gap-0.5">
            <span className="max-w-72 truncate font-heading text-body font-semibold tracking-[-0.012em]">{formatSource(item.source_url)}</span>
            <span className="line-clamp-1 max-w-72 text-caption whitespace-normal text-muted-foreground">
              {item.caption ?? item.error_message ?? DASH}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "source_type",
      header: "Type",
      filterFn: "equals",
      cell: ({ row }) => <Badge variant="outline">{SOURCE_TYPE[row.original.source_type]}</Badge>,
    },
    {
      accessorKey: "channel",
      header: "Channel",
      filterFn: "equals",
      cell: ({ row }) => <span className="text-caption">{CHANNEL[row.original.channel]}</span>,
    },
    {
      accessorKey: "places_count",
      header: sortable("Places"),
      cell: ({ row }) => <PlacesCell item={row.original} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      filterFn: (row, _id, value: TaskStatus[]) => value.includes(row.original.status),
      cell: ({ row: { original: item } }) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={TASK_STATUS[item.status].variant}>{TASK_STATUS[item.status].label}</Badge>
          {item.runs > 1 && <span className="micro-label">×{item.runs}</span>}
        </div>
      ),
    },
    {
      accessorKey: "total_ms",
      header: sortable("Time"),
      sortUndefined: "last",
      cell: ({ row }) => <span className="numeric text-caption font-bold text-muted-foreground">{formatDuration(row.original.total_ms)}</span>,
    },
    {
      accessorKey: "cost_usd",
      header: sortable("Cost"),
      sortUndefined: "last",
      cell: ({ row }) => <span className="numeric text-caption font-bold text-muted-foreground">{formatUsd(row.original.cost_usd)}</span>,
    },
    {
      accessorKey: "created_at",
      header: sortable("When"),
      cell: ({ row }) => <span className="text-caption text-muted-foreground">{formatRelative(row.original.created_at, now)}</span>,
    },
  ];
}

/**
 * The kit's runs screen: search and filters above, every recognition in a white card as a
 * table or a gallery of covers. Opening one puts its id in the URL.
 */
export function RecognitionsBrowser({
  items,
  onOpen,
  selectedId,
  pageSize = 10,
}: {
  items: RecognitionListItem[];
  onOpen: (id: string) => void;
  selectedId: string | null;
  pageSize?: number;
}) {
  const now = useNow();
  const href = useDetailHref();
  const columns = useColumns(now);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "gallery">("table");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useTable({
    features,
    data: query ? items.filter((item) => matches(item, query)) : items,
    columns,
    state: {
      sorting,
      columnFilters: statusTab === "all" ? columnFilters : [...columnFilters, { id: "status", value: STATUS_GROUP[statusTab] }],
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    initialState: { pagination: { pageIndex: 0, pageSize } },
    getRowId: (row) => row.id,
  });

  const setFilter = (id: "source_type" | "channel", value: string) => {
    setColumnFilters((current) => [...current.filter((f) => f.id !== id), ...(value === "all" ? [] : [{ id, value }])]);
    table.setPageIndex(0);
  };
  const filterValue = (id: string) => (columnFilters.find((f) => f.id === id)?.value as string | undefined) ?? "all";
  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-micro" />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              table.setPageIndex(0);
            }}
            placeholder="Search runs…"
            aria-label="Filter recognitions"
            className="pl-10"
          />
        </div>
        <Tabs
          value={statusTab}
          onValueChange={(value) => {
            setStatusTab(value as StatusTab);
            table.setPageIndex(0);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="open">Running</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={filterValue("source_type")} onValueChange={(value) => setFilter("source_type", value)}>
          <SelectTrigger className="w-36" aria-label="Type">
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
          <SelectTrigger className="w-40" aria-label="Channel">
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
          variant="segmented"
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

      <Card className="gap-3 p-2">
        {rows.length === 0 ? (
          <EmptyState title="Nothing matches these filters" description="Widen the filters or change the range." />
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
                  data-state={row.original.id === selectedId ? "selected" : undefined}
                  aria-current={row.original.id === selectedId ? "true" : undefined}
                  aria-label={`Open ${SOURCE_TYPE[row.original.source_type]} ${formatSource(row.original.source_url)}`}
                  className="cursor-pointer focus-visible:bg-grey-100 focus-visible:outline-solid focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-cobalt-300"
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
          <RecognitionGallery items={rows.map((row) => row.original)} href={href} now={now} selectedId={selectedId} className="p-2" />
        )}

        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <span className="micro-label">{formatInt(filteredCount)} recognitions</span>
          <div className="flex items-center gap-2">
            <span className="numeric text-caption font-bold text-muted-foreground">
              {table.state.pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <Button variant="secondary" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Covers first: what was shared is recognisable at a glance. Each cover links to its detail. */
export function RecognitionGallery({
  items,
  href,
  now,
  selectedId = null,
  className,
}: {
  items: RecognitionListItem[];
  href: (id: string) => string;
  now: number;
  selectedId?: string | null;
  className?: string;
}) {
  return (
    <ItemGroup className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {items.map((item) => (
        <Item
          key={item.id}
          asChild
          role="listitem"
          aria-current={item.id === selectedId ? "true" : undefined}
          className="group/cover gap-2.5 rounded-card p-2 hover:bg-grey-100 focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-cobalt-300 aria-[current=true]:bg-cobalt-50"
        >
          <Link href={href(item.id)} scroll={false}>
            <ItemHeader className="relative">
              <SourceCover
                url={item.thumbnail_url}
                type={item.source_type}
                sizes="(min-width: 1024px) 20vw, 45vw"
                className="w-full rounded-tile transition-transform duration-200 ease-spring group-hover/cover:scale-[1.02] motion-reduce:transition-none"
              />
              <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
                <Badge variant="outline" className="bg-card">
                  {SOURCE_TYPE[item.source_type]}
                </Badge>
                <Badge variant={TASK_STATUS[item.status].variant}>{TASK_STATUS[item.status].label}</Badge>
              </div>
            </ItemHeader>
            <ItemContent className="min-w-0 gap-0.5 px-1">
              <ItemTitle className="block w-full truncate font-heading text-body font-semibold">
                {item.place_names?.length ? item.place_names.join(", ") : item.status === "completed" ? "No places found" : DASH}
              </ItemTitle>
              <ItemDescription className="line-clamp-1">
                {CHANNEL[item.channel]} · {formatDuration(item.total_ms)} · {formatRelative(item.created_at, now)}
              </ItemDescription>
            </ItemContent>
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}
