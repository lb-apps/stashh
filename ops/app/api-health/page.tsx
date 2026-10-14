import type { Metadata } from "next";
import { ApiHealthPage } from "@/components/ops/pages/api-health-page";

export const metadata: Metadata = { title: "API health" };

export default function Page() {
  return <ApiHealthPage />;
}
