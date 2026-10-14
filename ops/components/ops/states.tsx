import { CircleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** A service did not answer: say which one and what to check. */
export function ServiceError({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>Veri alınamadı</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        <p className="text-muted-foreground">Servisin çalıştığını ve ops/.env.local ayarlarını kontrol et. Panel otomatik yeniden dener.</p>
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: ReactNode; icon?: ReactNode }) {
  return (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <Inbox />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}
