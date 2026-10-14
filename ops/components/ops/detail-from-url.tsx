"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { RecognitionDetailSheet } from "./recognition-detail";

/**
 * The recognition named in the URL (`?id=`) opens as a dialog (side sheet). Search params
 * are read inside these components' own Suspense boundaries, so pages hydrate together
 * with the layout.
 */
function useDetailParam() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const pathname = usePathname();
  return { id, close: () => router.replace(pathname, { scroll: false }) };
}

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

/** A runs table that knows which run is open, so its row stays highlighted behind the dialog. */
export function RunsWithDetail({ children }: { children: (selectedId: string | null) => ReactNode }) {
  return (
    <Suspense fallback={children(null)}>
      <RunsFromUrl>{children}</RunsFromUrl>
    </Suspense>
  );
}

function RunsFromUrl({ children }: { children: (selectedId: string | null) => ReactNode }) {
  const { id, close } = useDetailParam();
  return (
    <>
      {children(id)}
      <RecognitionDetailSheet id={id} onClose={close} />
    </>
  );
}
