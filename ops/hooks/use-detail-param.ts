"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * A recognition's detail lives in the URL (`?id=`), so the view can be linked and survives
 * reloads. Only the sheet reads the parameter (inside its own Suspense), so pages hydrate
 * together with the layout.
 */
export function useDetailHref(): (id: string) => string {
  const pathname = usePathname();
  return (id) => `${pathname}?id=${id}`;
}

/** For rows that open the detail on click (table rows cannot be links). */
export function useOpenDetail(): (id: string) => void {
  const router = useRouter();
  const href = useDetailHref();
  return (id) => router.push(href(id), { scroll: false });
}
