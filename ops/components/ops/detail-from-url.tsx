"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { useMinWidth } from "@/hooks/use-min-width";
import { RecognitionDetailPanel, RecognitionDetailSheet } from "./recognition-detail";

/** The kit docks the run detail beside the table once there is room for both. */
const DOCK_MIN_WIDTH = 1280;

/**
 * The recognition named in the URL (`?id=`). Search params are read inside these
 * components' own Suspense boundaries, so pages hydrate together with the layout.
 */
function useDetailParam() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const pathname = usePathname();
  return { id, close: () => router.replace(pathname, { scroll: false }) };
}

/** The detail in a side sheet, for pages without a runs table. */
export function RecognitionDetailFromUrl() {
  return (
    <Suspense fallback={null}>
      <SheetFromUrl />
    </Suspense>
  );
}

function SheetFromUrl() {
  const { id, close } = useDetailParam();
  return <RecognitionDetailSheet id={id} onClose={close} />;
}

/** A runs table with the selected run docked beside it on wide screens, in a sheet otherwise. */
/** `docked` is true while the detail sits beside the table, so the table can drop columns the panel shows. */
type RunsRender = (selectedId: string | null, docked: boolean) => ReactNode;

export function RunsWithDetail({ children }: { children: RunsRender }) {
  return (
    <Suspense fallback={<DockLayout table={children(null, false)} />}>
      <DockedFromUrl>{children}</DockedFromUrl>
    </Suspense>
  );
}

function DockedFromUrl({ children }: { children: RunsRender }) {
  const { id, close } = useDetailParam();
  const wide = useMinWidth(DOCK_MIN_WIDTH);
  return (
    <DockLayout
      table={children(id, Boolean(id && wide))}
      detail={
        id && wide ? (
          <RecognitionDetailPanel key={id} id={id} onClose={close} />
        ) : (
          <RecognitionDetailSheet id={wide ? null : id} onClose={close} />
        )
      }
    />
  );
}

function DockLayout({ table, detail }: { table: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex items-start gap-5">
      <div className="min-w-0 flex-1">{table}</div>
      {detail}
    </div>
  );
}
