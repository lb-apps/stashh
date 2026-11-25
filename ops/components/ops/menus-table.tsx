"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt, formatRelative, formatSource } from "@/lib/format";
import { MENU_STATUS, menuTypeLabel } from "@/lib/labels";
import type { PlaceMenuListItem } from "@/lib/ops-types";
import { cn } from "@/lib/utils";

export function MenusTable({
  items,
  selectedId,
  onOpen,
}: {
  items: PlaceMenuListItem[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const done = items.filter((m) => m.status === "done");
  const other = items.filter((m) => m.status !== "done");
  const totalItems = done.reduce((s, m) => s + m.items_count, 0);
  const totalCategories = done.reduce((s, m) => s + m.categories_count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {items.length} {items.length === 1 ? "menu" : "menus"}
          {done.length > 0 && (
            <span className="ml-3 font-normal text-body text-muted-foreground">
              {formatInt(totalCategories)} categories · {formatInt(totalItems)} items
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 overflow-x-auto px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Place</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Categories</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right pr-6">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No menus discovered yet.
                </TableCell>
              </TableRow>
            )}
            {items.map((menu) => {
              const st = MENU_STATUS[menu.status];
              return (
                <TableRow
                  key={menu.id}
                  className={cn("cursor-pointer", selectedId === menu.id && "bg-cobalt-50")}
                  onClick={() => onOpen(menu.id)}
                >
                  <TableCell className="pl-6 font-medium">{menu.place_name ?? menu.place_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </TableCell>
                  <TableCell>{menuTypeLabel(menu.menu_type)}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{formatSource(menu.source_url)}</TableCell>
                  <TableCell className="text-right font-numeric">{menu.status === "done" ? formatInt(menu.categories_count) : "—"}</TableCell>
                  <TableCell className="text-right font-numeric">{menu.status === "done" ? formatInt(menu.items_count) : "—"}</TableCell>
                  <TableCell className="text-right pr-6 text-muted-foreground">{formatRelative(menu.updated_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
