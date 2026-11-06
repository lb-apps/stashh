import Link from "next/link";
// Direct path, not the `@/lib/discovery` barrel: the barrel re-exports Icon,
// whose name lookup pulls every Lucide glyph (~650 KB) into this page.
import { BrandMoment } from "@/lib/discovery/components/BrandMoment";
import { InstagramCta } from "./_components/instagram-cta";

// Brand mode, start to finish: one full-bleed cobalt screen, one line, one
// action. Intentionally not a marketing page.
export default function HomePage() {
  return (
    <div className="ds-mode-brand flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col">
        <BrandMoment
          action={<InstagramCta>Instagram&rsquo;da yaz</InstagramCta>}
          headline="Stashh"
          style={{ flex: 1 }}
          sub="Bir Reel’i @stashh.me’ye gönder, içindeki mekânları sana listeleyelim."
        />
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-2 px-4 pb-6 text-caption">
        <Link className="inline-flex min-h-11 items-center px-3 underline underline-offset-4" href="/privacy">
          Gizlilik politikası
        </Link>
        <Link className="inline-flex min-h-11 items-center px-3 underline underline-offset-4" href="/data-deletion">
          Verilerini sildir
        </Link>
      </footer>
    </div>
  );
}
