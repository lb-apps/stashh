import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Gizlilik politikası",
  description:
    "Stashh'in Instagram mesajlarından hangi verileri neden işlediğini, kimlerle paylaştığını ve haklarını nasıl kullanabileceğini anlatır.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage other={{ href: "/data-deletion", label: "Verilerini sildir" }}>
      <Content />
    </LegalPage>
  );
}
