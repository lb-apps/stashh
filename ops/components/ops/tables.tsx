"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { DASH, formatDateTime, formatDuration, formatSource, formatUsd } from "@/lib/format";
import type { InstagramStats, QueueItem, RecognitionRun } from "@/lib/ops-types";
import { EmptyState } from "./states";

const OUTCOME = {
  completed: { label: "Yeni işlem", variant: "info" },
  cache_hit: { label: "Cache", variant: "secondary" },
  failed: { label: "Hata", variant: "danger" },
} as const;

const STEP_LABELS: Record<string, string> = {
  "content fetched": "İçerik alma",
  "media analyzed": "Model",
  "places found": "Google eşleşme",
  "thumbnails saved": "Görseller",
  "result saved": "Kaydetme",
  "cache checked": "Cache kontrolü",
  "served from cache": "Cache",
};

export const stepLabel = (step: string | null) => (step ? (STEP_LABELS[step] ?? step) : DASH);

/** Tasks waiting or running now; their waiting/running time ticks every second. */
export function QueueTable({ items }: { items: QueueItem[] }) {
  const now = useNow();
  if (items.length === 0) return <EmptyState title="Kuyruk boş" description="Bekleyen ya da işlenen tanıma yok." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Durum</TableHead>
          <TableHead>Kaynak</TableHead>
          <TableHead className="text-right">Bekleme</TableHead>
          <TableHead className="text-right">İşlem</TableHead>
          <TableHead className="text-right">Deneme</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const created = Date.parse(item.created_at);
          const started = item.started_at ? Date.parse(item.started_at) : null;
          return (
            <TableRow key={item.id}>
              <TableCell>
                <Badge variant={item.status === "processing" ? "info" : "warning"}>
                  {item.status === "processing" ? "İşleniyor" : "Kuyrukta"}
                </Badge>
              </TableCell>
              <TableCell className="max-w-72 truncate font-mono text-xs">{formatSource(item.source_url)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration((started ?? now) - created)}</TableCell>
              <TableCell className="text-right tabular-nums">{started ? formatDuration(now - started) : DASH}</TableCell>
              <TableCell className="text-right tabular-nums">{item.retry_count + 1}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Latest worker attempts with where their time went. */
export function RunsTable({ runs }: { runs: RecognitionRun[] }) {
  if (runs.length === 0) {
    return <EmptyState title="Henüz kayıtlı çalışma yok" description="Worker'ın her denemesi burada bir satır olarak görünecek." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bitiş</TableHead>
          <TableHead>Sonuç</TableHead>
          <TableHead>Kaynak</TableHead>
          <TableHead className="text-right">Toplam</TableHead>
          <TableHead className="text-right">İçerik</TableHead>
          <TableHead className="text-right">Model</TableHead>
          <TableHead className="text-right">Eşleşme</TableHead>
          <TableHead className="text-right">Mekân</TableHead>
          <TableHead className="text-right">Maliyet</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => {
          const outcome = OUTCOME[run.outcome];
          return (
            <TableRow key={run.id}>
              <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(run.finished_at)}</TableCell>
              <TableCell>
                {run.outcome === "failed" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={outcome.variant} tabIndex={0}>
                        {outcome.label} · {stepLabel(run.failed_step)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">{run.error_message ?? "Hata mesajı yok"}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Badge variant={outcome.variant}>{outcome.label}</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-64 truncate font-mono text-xs">
                {formatSource(run.source_url)}
                {run.attempt > 1 && <span className="ml-1 text-muted-foreground">· {run.attempt}. deneme</span>}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatDuration(run.total_ms)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(run.fetch_ms)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(run.analysis_ms)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(run.match_ms)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {run.places_extracted == null ? DASH : `${run.places_matched ?? 0}/${run.places_extracted}`}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatUsd(run.cost_usd)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const INTENT_LABELS: Record<string, string> = {
  recognize: "Tanıma",
  help: "Yardım",
  unsupported: "Desteklenmeyen",
  erase: "Silme",
};

export const intentLabel = (intent: string | null) => (intent ? (INTENT_LABELS[intent] ?? intent) : "Bilinmiyor");

/** DMs that ended without an answer. */
export function MessageFailuresTable({ failures }: { failures: InstagramStats["recent_failures"] }) {
  if (failures.length === 0) return <EmptyState title="Başarısız mesaj yok" description="Bu aralıkta her DM yanıtlandı." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bitiş</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Niyet</TableHead>
          <TableHead className="text-right">Deneme</TableHead>
          <TableHead>Son hata</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {failures.map((failure, index) => (
          <TableRow key={`${failure.finished_at}-${index}`}>
            <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(failure.finished_at)}</TableCell>
            <TableCell>
              <Badge variant={failure.status === "failed" ? "danger" : "warning"}>
                {failure.status === "failed" ? "Başarısız" : "Süresi doldu"}
              </Badge>
            </TableCell>
            <TableCell>{intentLabel(failure.intent)}</TableCell>
            <TableCell className="text-right tabular-nums">{failure.attempts}</TableCell>
            <TableCell className="max-w-md truncate text-muted-foreground">{failure.last_error ?? DASH}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
