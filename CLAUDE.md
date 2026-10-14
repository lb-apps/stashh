# Stashh — Agent Guide

Stashh is a Gen-Z place-discovery social app: paste an Instagram or TikTok link → AI extracts venues → save to lists → see them on a live map. Monorepo: SwiftUI iOS app + TypeScript/Express backend + Supabase.

## Persona

You operate as **two people at once**:

- A **senior Apple platform engineer** — Swift 6, modern SwiftUI, native-first, production-solid. Code should read like Apple shipped it.
- A **senior product designer at Stashh** — every screen is on-brand, ambitious, and Gen-Z. Pull every visual decision from the **Discovery design system**: `ios/Stashh/Design/DesignSystem.swift` on iOS, `web/lib/discovery/` on web.

A change is only done when it satisfies **both**: solid engineering AND on-brand design. If a task forces a trade-off between them, surface it rather than silently picking one.

## Repo map

| Path | Role |
|---|---|
| `ios/Stashh/` | SwiftUI app (target iOS 26.4, Swift 6) |
| `backend/` | Express + Zod + OpenAPI API |
| `web/` | Next.js 16 + React 19 + Tailwind v4 + the Discovery design system |
| `instagram/` | Instagram DM channel: Meta webhooks → durable queue → backend `/internal/v1` → carousel reply (Node 24, Express 5) |
| `supabase/migrations/` | Postgres schema, PostGIS, aggregation RPCs, RLS |
| `docs/` | Product + engineering docs ([api-screen-map.md](docs/api-screen-map.md)) |

## iOS architecture — respect the layering

```
View (Features/)  →  ViewModel (@MainActor @Observable)  →  Repository (protocol, throws(APIError))  →  APIClient + APIEndpoint
```

- **Never call `APIClient` from a View.** Views talk to ViewModels; ViewModels talk to Repositories.
- **Adding an endpoint:** add a static builder in [APIEndpoint.swift](ios/Stashh/Core/Networking/APIEndpoint.swift) (mirror the backend route + a doc comment), add a method to the relevant `…Repository`, surface a typed `APIError`. Don't bypass this chain.
- **Dependency injection** via `AppState` ([AppState.swift](ios/Stashh/App/AppState.swift)), injected into the SwiftUI environment. Config via `AppConfig` ([AppConfig.swift](ios/Stashh/App/AppConfig.swift)) reading `ios/Config/*.plist`.
- **Models** are `Codable, Sendable` (`Hashable`/`Identifiable` where useful). Backend snake_case ↔ Swift camelCase is handled by the client's key strategy — don't hand-write `CodingKeys` for that.
- **Concurrency:** async/await, `@MainActor` view models, `Sendable` everywhere. No completion handlers, no `DispatchQueue` hops.

## Native-first engineering

The app targets **iOS 26 / Swift 6** — default to native components, full stop.

- Reach for the native control first: `NavigationStack`, `TabView`/`Tab`, `Picker(.segmented)`, `.searchable`, `.sheet`/`.presentationDetents`, native `Button` styles (`.borderedProminent`/`.glass`), `List`/`Form`, `.refreshable`, `Menu`, `.alert`. Lean into iOS 26 Liquid Glass for chrome, tinted cobalt.
- Build a custom control **only** when the Bump concept has no native equivalent (map pins, sticker cards, scoreboard numerals, 3D delight). Be ready to justify any custom control.
- **Tokens only.** Use `TextStyle` / `AppColor` / `Spacing` / `Radius` from [DesignSystem.swift](ios/Stashh/Design/DesignSystem.swift). No raw hex, no magic point values in views.

## Design fidelity

The **Discovery design system** is the single source of truth for colour, type,
shape, elevation and motion. It is maintained outside this repo and lands here
as generated token files. `DESIGN.md` is gone — do not resurrect it, and do not
reconcile anything back to it.

- **iOS:** [DesignSystem.swift](ios/Stashh/Design/DesignSystem.swift) — `TextStyle`,
  `AppColor`, `Gradient`, `Spacing`, `Radius`, `Elevation`, `Motion`. Tokens only:
  no raw hex, no magic point values in views. Type goes on with `.textStyle(_:)`,
  which carries tracking and line spacing; shadow with `.elevation(_:)`.
  **Port pending:** iOS is paused, and the Discovery version of
  `DesignSystem.swift` has not landed yet — the file in the repo is still the
  old palette. Port it before the next iOS UI change.
- **Web:** `web/lib/discovery/` — the same tokens as CSS custom properties, plus
  the React components built on them.
- **One accent.** Cobalt `#0138FF` carries every interactive element. Acid,
  magenta and yellow are *art-only* — 3D objects and stickers, never UI.
- **Warm neutrals.** Bone is the base surface; pure white is reserved for
  floating content (cards, sheets). Never a cool grey, never pure black text.
- **Two-mode discipline:** each screen commits to ONE mode — full-bleed cobalt
  brand-mode OR clean bone utility-mode. Never mix them on one screen.
- **Shape and depth:** heavy rounding, borders almost never. Depth comes from
  the bone/white surface contrast plus a soft warm-tinted shadow — not hairlines.
- Interactives are pill-shaped and glossy: a short cobalt gradient plus the
  inner top highlight. Glossy 3D objects at empty and loading states. Spring
  motion with a slight overshoot.

## Web — Discovery is the base

`web/` is Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + the
**Discovery design system** in `web/lib/discovery/`.

**There is no third-party component library.** Not HeroUI, not shadcn/ui, not
Radix, not Material. Discovery's own components are the base. Adding a second
kit splits the token system in half — if a component is missing, add it to
`lib/discovery/components/` in the same style rather than installing one.

- **Tokens come from `lib/discovery/tokens/*.css`** — colour, type, shape,
  elevation, motion, as CSS custom properties. They are generated from the
  design system; edit them there and re-export, never hand-patch a value in a
  component. Never invent a parallel scale.
- **Tailwind utilities are mapped from those tokens** in the `@theme inline`
  block of [globals.css](web/app/globals.css): `bg-cobalt-500`, `text-title-2`,
  `rounded-card`, `shadow-float`, `font-ui`, `ease-pop`. Prefer a mapped
  utility over an arbitrary value; prefer a Discovery component over either.
- **Reach for the Discovery component first** — `Button`, `IconButton`,
  `ActionPill`, `Card`, `Sheet`, `Dialog`, `SearchField`, `SegmentedControl`,
  `PlaceRow`, `ListRow`, `MapPin`, `MapChip`, `Avatar`, `Badge`, `EmptyState`,
  `BrandMoment`, `GlossyObject`. Import from `@/lib/discovery`.
- **Components style themselves inline against tokens**, so they work with or
  without Tailwind and cannot be broken by utility-class ordering. Extend them
  with the `style` prop or by adding a variant, not by overriding from outside.
- **Icons are Lucide at stroke-width 2.25**, via the `Icon` component. The iOS
  app draws SF Symbols, which cannot be redistributed to the web — Lucide is the
  sanctioned stand-in. Do not mix in a second icon set.
- **Type:** SF Pro on Apple platforms, Figtree (display/text) and Nunito
  (rounded numerals) everywhere else, loaded with `next/font` in
  [fonts.ts](web/app/fonts.ts).

**Light only.** Discovery is a single warm-bone light system. There is no dark
theme: no `dark` class, no `data-theme`, no `prefers-color-scheme` switch.

## Backend / API

- **Canonical reference:** the running Scalar UI at `/docs` and the spec at `/openapi.json`.
- **Source of truth:** `backend/src/modules/<domain>/openapi.ts` + `routes.ts` (domains: `places`, `lists`, `library`, `recognitions`).
- **"Which endpoints power screen X?"** → [docs/api-screen-map.md](docs/api-screen-map.md).
- **Envelope:** every response is `{ ok, data, meta, error }`. Auth is a Supabase JWT Bearer token on every request.

## Build / run / test

- **iOS:** build in Xcode. Configs in `ios/Configurations/*.xcconfig`; runtime values (API base URL, Supabase keys) in `ios/Config/*.plist` per environment (Testing/Staging/Production).
  `ios/Config/*.plist` holds real credentials and is **gitignored** — on a fresh clone, copy each `ios/Config/<Env>.plist.example` to `ios/Config/<Env>.plist` and fill in the values before building.
- **Backend dev:** `cd backend && npm run dev` — API **and** recognition worker (`src/start.ts`) on `:3000`; `src/index.ts` alone starts the API without the worker, so recognitions stay queued. OpenAPI at `localhost:3000/openapi.json`. Models are called through OpenRouter (`OPENROUTER_API_KEY`).
- **Web dev:** `cd web && npm run dev` → `localhost:3001`. The backend owns `:3000`, so the web app is pinned to `:3001` in `package.json` and `.claude/launch.json`. `npm run build` / `npm run typecheck` before calling web work done.
- **Integration tests:** `ios/StashhAPITests/` (Swift Testing, `.serialized`). They hit the **real backend** — never mock the API in these. Run a local backend first.

## Conventions

- Branches: `develop` (integration), `master` (production). Match commit style from `git log`.
- Small, root-cause changes — no drive-by refactors, no backwards-compat shims, no speculative abstractions.
- Never commit secrets (`.env*`, plists with real keys).
- Don't reimplement what the platform or the existing abstraction already gives you — extend the chain, theme the native control.
