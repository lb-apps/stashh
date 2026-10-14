@AGENTS.md

# web/ — Agent Guide

See the **Web — Discovery is the base** section in the root [CLAUDE.md](../CLAUDE.md).

- **No third-party component library.** No HeroUI, no shadcn/ui, no Radix.
  The Discovery components in `lib/discovery/components/` are the base.
- **All design tokens come from `lib/discovery/tokens/*.css`**, exposed to
  Tailwind through the `@theme inline` block in `app/globals.css`.
- Import components from `@/lib/discovery`. They are client components and
  style themselves inline against the tokens.
- Icons: `<Icon name="map-pin" />` — Lucide at stroke-width 2.25, nothing else.
- Light only. No dark mode, no theme switching.
- Everything is modifiable — restyle and extend freely, but express it in
  Discovery tokens, and push a genuinely reusable change back into the design
  system rather than forking a component.

Routes: `app/(site)/` is the public stashh.me (Turkish, `/`, `/privacy`,
`/data-deletion`; legal copy lives in `content.mdx`, styled by
`mdx-components.tsx`). `app/(console)/console` and `app/api/**` are the
internal recognition console, 404 in production unless
`STASHH_CONSOLE_ENABLED=true` — gate through `lib/console-gate.ts`, never
inline. Public pages import Discovery components by file path, not the barrel:
the barrel re-exports `Icon`, which pulls every Lucide glyph into the bundle.
Dev server runs on `:3001` (the backend owns `:3000`).
