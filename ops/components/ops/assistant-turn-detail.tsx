"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DASH, formatDateTime, formatDuration, formatInt, formatShare, formatUsd } from "@/lib/format";
import { ASSISTANT_STATUS, toolLabel } from "@/lib/labels";
import type { AssistantMessage, AssistantPlanMessage, AssistantTurnDetail } from "@/lib/ops-types";
import { cn } from "@/lib/utils";
import { StatGrid } from "./stat-grid";

async function getDetail(id: string): Promise<AssistantTurnDetail> {
  const response = await fetch(`/api/ops/assistant/${id}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as AssistantTurnDetail;
}

/** The turn named in the URL (`?id=`) opens as a side sheet; only this reads the parameter. */
export function AssistantTurnFromUrl({ children }: { children: (selectedId: string | null) => ReactNode }) {
  return (
    <Suspense fallback={children(null)}>
      <TurnFromUrl>{children}</TurnFromUrl>
    </Suspense>
  );
}

function TurnFromUrl({ children }: { children: (selectedId: string | null) => ReactNode }) {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const pathname = usePathname();
  return (
    <>
      {children(id)}
      <AssistantTurnSheet id={id} onClose={() => router.replace(pathname, { scroll: false })} />
    </>
  );
}

export function AssistantTurnSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error } = useQuery({ queryKey: ["ops", "assistant-turn", id], queryFn: () => getDetail(id!), enabled: id != null });
  return (
    <Sheet open={id != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <ScrollArea className="h-full">
          <SheetHeader className="sr-only">
            <SheetTitle>{data ? `Turn with ${data.username ? `@${data.username}` : "a person"}` : "Assistant turn"}</SheetTitle>
            <SheetDescription>{data ? formatDateTime(data.created_at) : "Loading the turn"}</SheetDescription>
          </SheetHeader>
          <div className="p-6 pr-12">{data ? <DetailBody detail={data} /> : <DetailPending error={error} />}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function DetailPending({ error }: { error: Error | null }) {
  if (error) {
    return (
      <div className="grid gap-4">
        <p className="font-heading text-headline">Could not open the turn</p>
        <p className="text-caption text-muted-foreground">{error.message}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-[72px]" />
        <Skeleton className="h-[72px]" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="micro-label">{label}</h3>
      {children}
    </section>
  );
}

function DetailBody({ detail }: { detail: AssistantTurnDetail }) {
  const status = ASSISTANT_STATUS[detail.status];
  const cached = detail.prompt_tokens ? formatShare(detail.cached_tokens ?? 0, detail.prompt_tokens) : DASH;
  const own = detail.messages.filter((m) => m.turn_id === detail.id);
  const before = detail.messages.filter((m) => m.turn_id !== detail.id);

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h2 className="font-heading text-headline font-black">{detail.display_name ?? (detail.username ? `@${detail.username}` : "Someone")}</h2>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {detail.username && detail.display_name && <span className="text-caption text-muted-foreground">@{detail.username}</span>}
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-caption text-muted-foreground">{formatDateTime(detail.created_at)}</span>
        </div>
      </div>

      {detail.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{detail.status === "failed" ? "The turn failed" : "Note"}</AlertTitle>
          <AlertDescription>{detail.error}</AlertDescription>
        </Alert>
      )}

      <Section label="Conversation">
        <div className="grid gap-2">
          {before.length > 0 && <p className="micro-label">Earlier, as the model saw it</p>}
          {before.map((message) => (
            <Bubble key={message.id} message={message} muted />
          ))}
          {before.length > 0 && <p className="micro-label pt-2">This turn</p>}
          {own.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
        </div>
      </Section>

      {detail.plan && (
        <Section label={`Sent · ${formatInt(detail.plan.messages.length)} message${detail.plan.messages.length === 1 ? "" : "s"}`}>
          <ItemGroup role="list" className="gap-2">
            {detail.plan.messages.map((message, index) => (
              <PlanItem key={index} message={message} />
            ))}
          </ItemGroup>
        </Section>
      )}

      <Section label="Process">
        <StatGrid
          size="md"
          className="grid-cols-2 sm:grid-cols-2"
          stats={[
            { label: "Duration", value: formatDuration(detail.duration_ms) },
            { label: "Cost", value: detail.cost_usd == null ? DASH : formatUsd(detail.cost_usd) },
            { label: "Model calls", value: formatInt(detail.steps) },
            { label: "From cache", value: cached },
          ]}
        />
        <p className="text-caption text-muted-foreground">
          {detail.model ?? "No model"}
          {detail.provider ? ` via ${detail.provider}` : ""} · {formatInt(detail.prompt_tokens)} in / {formatInt(detail.completion_tokens)} out tokens
        </p>
        {detail.tool_names.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {detail.tool_names.map((name, index) => (
              <Badge key={`${name}-${index}`} variant="outline">
                {toolLabel(name)}
              </Badge>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/** One message of the thread, the person's on the right like a chat, the assistant's on the left. */
function Bubble({ message, muted = false }: { message: AssistantMessage; muted?: boolean }) {
  const mine = message.role === "assistant";
  const notes: string[] = [];
  if (message.rich?.cards?.length) notes.push(`cards: ${message.rich.cards.join(", ")}`);
  if (message.rich?.quick_replies?.length) notes.push(`quick replies: ${message.rich.quick_replies.join(" · ")}`);
  if (message.rich?.map_link) notes.push("map link button");
  return (
    <div className={cn("flex", mine ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-[20px] px-4 py-2.5 text-body whitespace-pre-line",
          mine ? "bg-bone-300 text-foreground" : "bg-cobalt-500 text-white",
          muted && "opacity-70",
        )}
      >
        {message.content}
        {notes.length > 0 && <span className={cn("mt-1 block text-caption", mine ? "text-muted-foreground" : "text-white/80")}>{notes.join(" · ")}</span>}
      </div>
    </div>
  );
}

function PlanItem({ message }: { message: AssistantPlanMessage }) {
  if (message.kind === "carousel") {
    return (
      <Item role="listitem" variant="muted" size="sm" className="px-3.5 py-3">
        <ItemContent className="min-w-0 gap-0.5">
          <ItemTitle>Carousel · {formatInt(message.cards.length)} cards</ItemTitle>
          <ItemDescription className="truncate">{message.cards.map((card) => card.title).join(" · ")}</ItemDescription>
        </ItemContent>
      </Item>
    );
  }
  const quick = message.quick_replies?.map((item) => item.title) ?? [];
  const buttons = message.kind === "button" ? message.buttons.map((button) => button.title) : [];
  return (
    <Item role="listitem" variant="muted" size="sm" className="px-3.5 py-3">
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle>{message.kind === "button" ? "Text with buttons" : "Text"}</ItemTitle>
        <ItemDescription className="whitespace-pre-line text-foreground">{message.text}</ItemDescription>
        {(buttons.length > 0 || quick.length > 0) && (
          <ItemDescription>
            {buttons.length > 0 ? `buttons: ${buttons.join(" · ")}` : ""}
            {buttons.length > 0 && quick.length > 0 ? " · " : ""}
            {quick.length > 0 ? `quick replies: ${quick.join(" · ")}` : ""}
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
