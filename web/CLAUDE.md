@AGENTS.md

# Stashh Web

See the **Web — HeroUI is the base** section in the root [CLAUDE.md](../CLAUDE.md).

Short version:
- **HeroUI v3 is the only component library.** No shadcn/ui, no Radix, no other kit.
- All design tokens come from `@heroui/styles`. Brand overrides live in the `:root`
  block of `app/globals.css`, in `oklch`, derived from `../DESIGN.md`.
- HeroUI v3 is compound (`<Card><Card.Header>`), needs no provider, and uses
  `onPress` rather than `onClick`. Tailwind v4 is required.
- Everything is modifiable — restyle and extend freely, but express it in HeroUI tokens.
- Dev server runs on `:3001` (the backend owns `:3000`).
