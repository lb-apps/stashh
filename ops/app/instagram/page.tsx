import type { Metadata } from "next";
import { InstagramPage } from "@/components/ops/pages/instagram-page";

export const metadata: Metadata = { title: "Instagram" };

export default function Page() {
  return <InstagramPage />;
}
