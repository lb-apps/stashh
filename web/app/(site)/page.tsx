import Link from "next/link";
// Direct path, not the `@/lib/discovery` barrel: the barrel re-exports Icon,
// whose name lookup pulls every Lucide glyph (~650 KB) into this page.
import { BrandMoment } from "@/lib/discovery/components/BrandMoment";

const INSTAGRAM_DM = "https://ig.me/m/stashh.me";

// Brand mode, start to finish: one full-bleed cobalt screen, one line, one
// action. Intentionally not a marketing page.
export default function HomePage() {
  return (
    <div className="ds-mode-brand flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col">
        <BrandMoment
          action={
            // Discovery's Button is a <button>; this navigates, so it is an
            // <a> drawn to the same spec as Button `variant="onBrand" size="lg"`.
            <a
              className="press inline-flex h-14.5 items-center justify-center rounded-cta bg-surface-card px-6.5 font-ui text-body-lg font-semibold tracking-(--tr-tight) text-cobalt-500 shadow-float hover:opacity-100"
              href={INSTAGRAM_DM}
            >
              Instagram&rsquo;da yaz
            </a>
          }
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
