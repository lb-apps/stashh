import Link from "next/link";
// Direct path, not the barrel — see app/(site)/page.tsx.
import { Card } from "@/lib/discovery/components/Card";

/**
 * Utility-mode frame for a legal document: bone base, the document on a white
 * Discovery card at a readable measure, the wordmark home, and a footer link to
 * the other legal page. The document itself is MDX, styled by
 * `mdx-components.tsx`.
 */
export function LegalPage({
  children,
  other,
}: {
  children: React.ReactNode;
  other: { href: "/privacy" | "/data-deletion"; label: string };
}) {
  return (
    <div className="ds-mode-utility flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-3xl px-4 pt-6 sm:px-gutter-web sm:pt-10">
        <Link
          className="ds-title-2 inline-flex min-h-11 items-center text-cobalt-500"
          href="/"
        >
          Stashh
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-gutter-web sm:py-10">
        <Card padding={0}>
          <article className="mx-auto max-w-[68ch] px-6 py-8 break-words sm:px-12 sm:py-12">
            {children}
          </article>
        </Card>
      </main>

      <footer className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pb-8 text-caption sm:px-gutter-web">
        <Link className="inline-flex min-h-11 items-center" href={other.href}>
          {other.label}
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/">
          stashh.me
        </Link>
      </footer>
    </div>
  );
}
