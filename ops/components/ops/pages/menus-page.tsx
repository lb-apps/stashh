"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMenuList } from "@/hooks/use-ops-data";
import { PageHeader } from "../page-header";
import { ServiceError } from "../states";
import { MenusTable } from "../menus-table";
import { MenuDetailSheet } from "../menu-detail";
import { PanelSkeleton } from "../sections";

export function MenusPage() {
  const { data: menus, error } = useMenuList();

  return (
    <>
      <PageHeader title="Menus" description="Discovered menus for recognized places" controls={false} />
      {error && <ServiceError error={error} />}
      {menus ? (
        <Suspense fallback={<MenusTable items={menus} selectedId={null} onOpen={() => {}} />}>
          <MenusWithDetail items={menus} />
        </Suspense>
      ) : (
        <PanelSkeleton height="h-96" />
      )}
    </>
  );
}

function MenusWithDetail({ items }: { items: Parameters<typeof MenusTable>[0]["items"] }) {
  const { id, close } = useMenuDetailParam();
  const router = useRouter();
  const pathname = usePathname();
  const open = (menuId: string) => router.push(`${pathname}?id=${menuId}`, { scroll: false });

  return (
    <>
      <MenusTable items={items} selectedId={id} onOpen={open} />
      <MenuDetailSheet id={id} onClose={close} />
    </>
  );
}

function useMenuDetailParam() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const pathname = usePathname();
  return { id, close: () => router.replace(pathname, { scroll: false }) };
}
