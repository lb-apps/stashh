import type { Metadata } from "next";
import { RecognizePage } from "@/components/ops/pages/recognize-page";

export const metadata: Metadata = { title: "Recognize a link" };

export default function Page() {
  return <RecognizePage />;
}
