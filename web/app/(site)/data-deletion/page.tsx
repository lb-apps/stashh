import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Verilerini sildir",
  description:
    "Stashh'teki verilerini Instagram'dan \"sil\" yazarak ya da e-postayla nasıl sildirebileceğini anlatır.",
  alternates: { canonical: "/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <LegalPage other={{ href: "/privacy", label: "Gizlilik politikası" }}>
      <Content />
    </LegalPage>
  );
}
