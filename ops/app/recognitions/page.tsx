import type { Metadata } from "next";
import { RecognitionsPage } from "@/components/ops/pages/recognitions-page";

export const metadata: Metadata = { title: "Recognitions" };

export default function Page() {
  return <RecognitionsPage />;
}
