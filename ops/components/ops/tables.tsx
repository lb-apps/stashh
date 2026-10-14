"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { DASH, formatDateTime, formatDuration, formatSource } from "@/lib/format";
import { DM_CONTENT, intentLabel } from "@/lib/labels";
import type { InstagramStats, QueueItem } from "@/lib/ops-types";
import { EmptyState } from "./states";

/** Tasks waiting or running now; their waiting/running time ticks every second. */
export function QueueTable({ items, onOpen }: { items: QueueItem[]; onOpen?: (id: string) => void }) {
  const now = useNow();
  if (items.length === 0) return <EmptyState title="Queue is empty" description="No recognition is waiting or running." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Wait</TableHead>
          <TableHead className="text-right">Running</TableHead>
          <TableHead className="text-right">Attempts</TableHead>
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
                  {item.status === "processing" ? "Processing" : "Queued"}
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

/** DMs that ended without an answer. */
export function MessageFailuresTable({ failures }: { failures: InstagramStats["recent_failures"] }) {
  if (failures.length === 0) return <EmptyState title="No unanswered messages" description="Every DM in this range got a reply." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Finished</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Content</TableHead>
          <TableHead>Intent</TableHead>
          <TableHead className="text-right">Attempts</TableHead>
          <TableHead>Last error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {failures.map((failure, index) => (
          <TableRow key={`${failure.finished_at}-${index}`}>
            <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(failure.finished_at)}</TableCell>
            <TableCell>
              <Badge variant={failure.status === "failed" ? "danger" : "warning"}>
                {failure.status === "failed" ? "Failed" : "Expired"}
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
