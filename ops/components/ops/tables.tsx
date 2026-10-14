"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { DASH, formatDateTime, formatDuration, formatSource } from "@/lib/format";
import { DM_CONTENT } from "@/lib/labels";
import type { InstagramStats, QueueItem } from "@/lib/ops-types";
import { EmptyState } from "./states";

/** Tasks waiting or running now; their waiting/running time ticks every second. */
export function QueueTable({ items, onOpen }: { items: QueueItem[]; onOpen?: (id: string) => void }) {
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
            <TableRow
              key={item.id}
              className={onOpen ? "cursor-pointer" : undefined}
              onClick={onOpen ? () => onOpen(item.id) : undefined}
            >
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

const INTENT_LABELS: Record<string, string> = {
  recognize: "Tanıma",
  help: "Yardım",
  unsupported: "Desteklenmeyen",
  erase: "Silme",
};

export const intentLabel = (intent: string | null) => (intent ? (INTENT_LABELS[intent] ?? intent) : "Bilinmiyor");

/** DMs that ended without an answer. */
export function MessageFailuresTable({ failures }: { failures: InstagramStats["recent_failures"] }) {
  if (failures.length === 0) return <EmptyState title="Yanıtsız mesaj yok" description="Bu aralıkta her DM yanıtlandı." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bitiş</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>İçerik</TableHead>
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
            <TableCell>{DM_CONTENT[failure.content]}</TableCell>
            <TableCell>{intentLabel(failure.intent)}</TableCell>
            <TableCell className="text-right tabular-nums">{failure.attempts}</TableCell>
            <TableCell className="max-w-md truncate text-muted-foreground">{failure.last_error ?? DASH}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
