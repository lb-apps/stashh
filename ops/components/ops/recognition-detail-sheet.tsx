"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, ExternalLink, MapPin, Star } from "lucide-react";
import Image from "next/image";
import { Suspense, useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DASH, formatBytes, formatDateTime, formatDuration, formatInt, formatSource, formatUsd } from "@/lib/format";
import { CHANNEL, FETCH_METHOD, RUN_OUTCOME, SOURCE_TYPE, TASK_STATUS, stepLabel } from "@/lib/labels";
import type { RecognitionDetail, RecognitionPlace, RecognitionRunDetail } from "@/lib/ops-types";
import { RecognitionThumb } from "./recognition-thumb";

async function getDetail(id: string): Promise<RecognitionDetail> {
  const response = await fetch(`/api/ops/recognitions/${id}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as RecognitionDetail;
}

/**
 * The sheet for the recognition named in the URL (`?id=`). It reads search params in its own
 * Suspense boundary so the page around it hydrates with the layout.
 */
export function RecognitionDetailFromUrl() {
  return (
    <Suspense fallback={null}>
      <SheetForSearchParam />
    </Suspense>
  );
}

function SheetForSearchParam() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const pathname = usePathname();
  return <RecognitionDetailSheet id={id} onClose={() => router.replace(pathname, { scroll: false })} />;
}

/** One recognition's whole story in a side sheet; it refreshes while the task is still running. */
export function RecognitionDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error, isPending } = useQuery({
    queryKey: ["ops", "recognition", id],
    queryFn: () => getDetail(id!),
    enabled: id != null,
    refetchInterval: (query) => (query.state.data && ["queued", "processing"].includes(query.state.data.status) ? 3_000 : false),
  });

  return (
    <Sheet open={id != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        {data ? (
          <DetailBody detail={data} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{error ? "Tanıma açılamadı" : "Yükleniyor"}</SheetTitle>
              <SheetDescription>{error ? error.message : "Tanımanın ayrıntıları getiriliyor."}</SheetDescription>
            </SheetHeader>
            {isPending && !error && <DetailSkeleton />}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 p-4">
      <div className="flex gap-4">
        <Skeleton className="size-28 rounded-xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function DetailBody({ detail }: { detail: RecognitionDetail }) {
  const status = TASK_STATUS[detail.status];
  const firstRun = detail.runs[0];
  const lastRun = detail.runs.at(-1);
  const waited = firstRun ? Date.parse(firstRun.started_at) - Date.parse(detail.created_at) : null;
  const cost = detail.runs.reduce((sum, run) => sum + (run.cost_usd ?? 0), 0);
  const isUrl = detail.source_url.startsWith("http");

  return (
    <ScrollArea className="h-full">
      <SheetHeader className="gap-3 border-b pb-4">
        <div className="flex gap-4 pr-8">
          <RecognitionThumb url={detail.source?.thumbnail_url ?? null} type={detail.source_type} className="size-28 rounded-xl" sizes="112px" />
          <div className="grid min-w-0 content-start gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="info">{SOURCE_TYPE[detail.source_type]}</Badge>
              <Badge variant="outline">{CHANNEL[detail.channel]}</Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <SheetTitle className="truncate font-mono text-sm font-medium">{formatSource(detail.source_url)}</SheetTitle>
            <SheetDescription className="tabular-nums">
              {formatDateTime(detail.created_at)} · {detail.runs.length} deneme
            </SheetDescription>
            {isUrl && (
              <Button asChild variant="outline" size="sm" className="w-fit">
                <a href={detail.source_url} target="_blank" rel="noreferrer">
                  Kaynağı aç <ExternalLink aria-hidden />
                </a>
              </Button>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Kuyrukta bekleme">{formatDuration(waited)}</Fact>
          <Fact label="Son deneme">{formatDuration(lastRun?.total_ms)}</Fact>
          <Fact label="Mekân">{detail.places.length}</Fact>
          <Fact label="Maliyet">{detail.runs.some((r) => r.cost_usd != null) ? formatUsd(cost) : DASH}</Fact>
        </dl>
      </SheetHeader>

      <div className="grid gap-6 p-4">
        {detail.status === "failed" && detail.error_message && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Başarısız</AlertTitle>
            <AlertDescription>{detail.error_message}</AlertDescription>
          </Alert>
        )}

        {detail.source?.caption && <Caption text={detail.source.caption} />}

        <Section title="Süreç" description="Her deneme ve zamanın adımlara dağılımı">
          {detail.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu tanıma kayıt tutulmaya başlanmadan önce işlendi; adım ayrıntısı yok.</p>
          ) : (
            <ol className="grid gap-4">
              {detail.runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </ol>
          )}
        </Section>

        <Separator />

        <Section title="Sonuç" description={detail.places.length ? `${detail.places.length} mekân bulundu` : "Mekân bulunamadı"}>
          {detail.places.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {detail.places.map((place) => (
                <PlaceCard key={place.google_place_id} place={place} />
              ))}
            </ul>
          )}
        </Section>

        <Separator />
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <Fact label="Görev">
            <span className="font-mono text-xs">{detail.id}</span>
          </Fact>
          <Fact label="Kullanıcı">
            <span className="font-mono text-xs">{detail.owner_user_id}</span>
          </Fact>
        </dl>
      </div>
    </ScrollArea>
  );
}

function Caption({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Açıklama">
      <p className={`text-sm whitespace-pre-line ${open ? "" : "line-clamp-4"}`}>{text}</p>
      {text.length > 240 && (
        <Button variant="link" size="sm" className="h-auto w-fit p-0" onClick={() => setOpen(!open)}>
          {open ? "Daha az göster" : "Devamını göster"}
        </Button>
      )}
    </Section>
  );
}

const STEP_SEGMENTS = [
  { key: "fetch_ms", step: "content fetched", color: "var(--chart-3)" },
  { key: "analysis_ms", step: "media analyzed", color: "var(--chart-1)" },
  { key: "match_ms", step: "places found", color: "var(--chart-2)" },
  { key: "thumbnails_ms", step: "thumbnails saved", color: "var(--chart-4)" },
  { key: "save_ms", step: "result saved", color: "var(--muted-foreground)" },
] as const;

/** One attempt: outcome, a bar split into its steps, and what the model used. */
function RunCard({ run }: { run: RecognitionRunDetail }) {
  const outcome = RUN_OUTCOME[run.outcome];
  const segments = STEP_SEGMENTS.map((segment) => ({ ...segment, ms: run[segment.key] ?? 0 })).filter((s) => s.ms > 0);
  const stepTotal = segments.reduce((sum, s) => sum + s.ms, 0);

  return (
    <li className="grid gap-3 rounded-xl bg-muted/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{run.attempt}. deneme</span>
        <Badge variant={outcome.variant}>{outcome.label}</Badge>
        {run.fetch_method && <Badge variant="outline">{FETCH_METHOD[run.fetch_method]}</Badge>}
        <span className="ml-auto text-sm font-medium tabular-nums">{formatDuration(run.total_ms)}</span>
      </div>

      {segments.length > 0 && (
        <div className="grid gap-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-card" role="img" aria-label="Adımlara göre süre">
            {segments.map((segment) => (
              <Tooltip key={segment.key}>
                <TooltipTrigger asChild>
                  <div className="h-full" style={{ width: `${(segment.ms / stepTotal) * 100}%`, background: segment.color }} />
                </TooltipTrigger>
                <TooltipContent>
                  {stepLabel(segment.step)}: {formatDuration(segment.ms)}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {segments.map((segment) => (
              <li key={segment.key} className="flex items-center gap-1.5 tabular-nums">
                <span aria-hidden className="size-2 rounded-[2px]" style={{ background: segment.color }} />
                {stepLabel(segment.step)} {formatDuration(segment.ms)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.model && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Model">
            <span className="text-xs">{run.model.replace(/^google\//, "")}</span>
          </Fact>
          <Fact label="Medya">
            {run.media_kind === "image" ? "Görsel" : run.media_kind === "video" ? "Video" : DASH} · {formatBytes(run.media_bytes)}
          </Fact>
          <Fact label="Token">
            {formatInt((run.prompt_tokens ?? 0) + (run.completion_tokens ?? 0))}
          </Fact>
          <Fact label="Maliyet">{formatUsd(run.cost_usd)}</Fact>
        </dl>
      )}

      {run.outcome === "failed" && (
        <p className="rounded-lg bg-card p-2 text-xs">
          <span className="font-medium">{stepLabel(run.failed_step)}:</span> {run.error_message ?? "Hata mesajı yok"}
        </p>
      )}
    </li>
  );
}

/** A found place the way the person sees it: photo, name, rating, address, links, tips. */
function PlaceCard({ place }: { place: RecognitionPlace }) {
  const maps =
    place.google_maps_uri ??
    `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: place.name, query_place_id: place.google_place_id })}`;
  return (
    <li className="grid gap-3 overflow-hidden rounded-xl bg-card depth-card">
      <div className="relative aspect-[16/9] bg-muted">
        {place.thumbnail_url ? (
          <Image src={place.thumbnail_url} alt="" fill sizes="(min-width: 640px) 320px, 100vw" className="object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <MapPin aria-hidden className="size-6" />
          </div>
        )}
      </div>
      <div className="grid gap-2 px-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-heading font-semibold">{place.name}</p>
          {place.rating != null && (
            <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
              <Star aria-hidden className="size-3.5 fill-current" />
              {place.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}
            </span>
          )}
        </div>
        {place.address && <p className="line-clamp-2 text-xs text-muted-foreground">{place.address}</p>}
        {place.recommendations && place.recommendations.length > 0 && (
          <ul className="grid gap-1 text-xs">
            {place.recommendations.slice(0, 3).map((tip) => (
              <li key={tip.summary} className="rounded-md bg-muted px-2 py-1">
                {tip.summary}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={maps} target="_blank" rel="noreferrer">
              Haritada aç <ExternalLink aria-hidden />
            </a>
          </Button>
          {place.instagram_username && (
            <Button asChild variant="ghost" size="sm">
              <a href={`https://www.instagram.com/${encodeURIComponent(place.instagram_username)}/`} target="_blank" rel="noreferrer">
                @{place.instagram_username}
              </a>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
