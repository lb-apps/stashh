"use client";

import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DASH, formatInt, formatSource } from "@/lib/format";
import { MENU_STATUS, menuTypeLabel } from "@/lib/labels";
import type { MenuDetail, MenuDetailCategory } from "@/lib/ops-types";
import { useMenuDetail } from "@/hooks/use-ops-data";

export function MenuDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error } = useMenuDetail(id);
  return (
    <Sheet open={id != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <ScrollArea className="h-full">
          <SheetHeader className="sr-only">
            <SheetTitle>{data ? formatSource(data.source_url) : "Menu"}</SheetTitle>
            <SheetDescription>{data ? `${menuTypeLabel(data.menu_type)} · ${data.language}` : "Loading the menu"}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-6 p-6">
            {error && <p className="text-body text-destructive">Failed to load menu.</p>}
            {!data && !error && (
              <div className="grid gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-64 w-full" />
              </div>
            )}
            {data && <MenuDetailContent detail={data} />}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MenuDetailContent({ detail }: { detail: MenuDetail }) {
  const st = MENU_STATUS[detail.status];
  const categories = detail.menu_categories ?? [];
  const totalItems = categories.reduce((s, c) => s + (c.menu_items?.length ?? 0), 0);

  return (
    <>
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={st.variant}>{st.label}</Badge>
          <span className="text-caption font-semibold">{menuTypeLabel(detail.menu_type)}</span>
          <span className="text-caption text-muted-foreground">{detail.language}</span>
        </div>
        {detail.source_url && (
          <a
            href={detail.source_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
          >
            <span className="min-w-0 truncate">{formatSource(detail.source_url)}</span>
            <ExternalLink aria-hidden className="size-3 shrink-0" />
          </a>
        )}
        {categories.length > 0 && (
          <p className="numeric text-caption text-muted-foreground">
            {formatInt(categories.length)} categories · {formatInt(totalItems)} items
          </p>
        )}
      </div>

      {categories.length === 0 && (
        <p className="text-caption text-muted-foreground">No parsed categories.</p>
      )}

      <div className="grid gap-3">
        {categories
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((cat) => (
            <MenuCategoryBlock key={cat.id} category={cat} />
          ))}
      </div>
    </>
  );
}

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return DASH;
  if (currency === "TRY") return `₺${price.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return `${price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}`;
}

function MenuCategoryBlock({ category }: { category: MenuDetailCategory }) {
  const [open, setOpen] = useState(false);
  const items = category.menu_items ?? [];
  const hasItems = items.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-left hover:bg-muted"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
          <span className="flex-1 font-heading text-caption font-bold">
            {category.name}
            {category.name_en && category.name !== category.name_en && (
              <span className="ml-1.5 font-normal text-muted-foreground">{category.name_en}</span>
            )}
          </span>
          <span className="numeric text-caption text-muted-foreground">{items.length}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {hasItems && (
          <div className="grid gap-1 pl-5 pt-1">
            {items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div key={item.id} className="flex items-start gap-2 py-1">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      className="mt-0.5 size-10 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  )}
                  <span className="min-w-0 flex-1 text-caption">
                    {item.name}
                    {item.name_en && item.name !== item.name_en && (
                      <span className="ml-1 text-muted-foreground">{item.name_en}</span>
                    )}
                    {item.description && <span className="block text-muted-foreground">— {item.description}</span>}
                    {item.tags.length > 0 && (
                      <span className="block text-muted-foreground">{item.tags.join(" · ")}</span>
                    )}
                  </span>
                  <span className="numeric shrink-0 text-caption font-semibold">{formatPrice(item.price, item.currency)}</span>
                </div>
              ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
