import type { Metadata } from "next";
import { AssistantPage } from "@/components/ops/pages/assistant-page";

export const metadata: Metadata = { title: "Assistant" };

export default function Page() {
  return <AssistantPage />;
}
