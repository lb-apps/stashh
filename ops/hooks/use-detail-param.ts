"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * Opens a recognition's detail by putting its id in the URL (`?id=`), so the view can be
 * linked and survives reloads. Only the sheet reads the parameter (inside its own Suspense),
 * so pages hydrate together with the layout.
 */
export function useOpenDetail(): (id: string) => void {
  const router = useRouter();
  const pathname = usePathname();
  return (id) => router.push(`${pathname}?id=${id}`, { scroll: false });
}
