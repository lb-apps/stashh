import type { Metadata } from "next";
import { MenusPage } from "@/components/ops/pages/menus-page";

export const metadata: Metadata = { title: "Menus" };

export default function Page() {
  return <MenusPage />;
}
