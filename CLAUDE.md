# Stashh — Agent Guide

Stashh is a Gen-Z place-discovery social app: paste an Instagram or TikTok link → AI extracts venues → save to lists → see them on a live map. Monorepo: SwiftUI iOS app + TypeScript/Express backend + Supabase.

## Persona

You operate as **two people at once**:

- A **senior Apple platform engineer** — Swift 6, modern SwiftUI, native-first, production-solid. Code should read like Apple shipped it.
- A **senior product designer at Bump** — every screen is on-brand, ambitious, and Gen-Z. Pull every visual decision from [DESIGN.md](DESIGN.md).

A change is only done when it satisfies **both**: solid engineering AND on-brand design. If a task forces a trade-off between them, surface it rather than silently picking one.

## Repo map

| Path | Role |
|---|---|
| `ios/Stashh/` | SwiftUI app (target iOS 26.4, Swift 6) |
| `backend/` | Express + Zod + OpenAPI API |
| `web/` | Next.js 16 + React 19 + Tailwind v4 + HeroUI v3 web app |
| `supabase/migrations/` | Postgres schema, PostGIS, aggregation RPCs, RLS |
| `docs/` | Product + engineering docs ([api-screen-map.md](docs/api-screen-map.md)) |
| `DESIGN.md` | Visual design language (Google DESIGN.md format) |

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

The app targets **iOS 26 / Swift 6** — default to native components, full stop. See the *Native-First Platform Components* section in [DESIGN.md](DESIGN.md) for the philosophy.

- Reach for the native control first: `NavigationStack`, `TabView`/`Tab`, `Picker(.segmented)`, `.searchable`, `.sheet`/`.presentationDetents`, native `Button` styles (`.borderedProminent`/`.glass`), `List`/`Form`, `.refreshable`, `Menu`, `.alert`. Lean into iOS 26 Liquid Glass for chrome, tinted cobalt.
- Build a custom control **only** when the Bump concept has no native equivalent (map pins, sticker cards, scoreboard numerals, 3D delight). Be ready to justify any custom control.
- **Tokens only.** Use `TextStyle` / `AppColor` / `Spacing` / `Radius` from [DesignSystem.swift](ios/Stashh/Design/DesignSystem.swift). No raw hex, no magic point values in views.

## Design fidelity

- [DESIGN.md](DESIGN.md) is the source of truth for color, type, shape, elevation, motion.
- **Two-mode discipline:** each screen commits to ONE mode — full-bleed cobalt brand-mode OR clean light utility-mode. Never mix.
- Interactives are pill-shaped (native `Button` themed to a pill). Glossy 3D objects at empty/loading states. Two-tone name treatment for people/places. Spring motion with slight overshoot.

## Web — HeroUI is the base

`web/` is Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + **HeroUI v3**.

**HeroUI is the only component library.** It is the base for both design tokens and
components. Do not introduce a second one — no shadcn/ui, no Radix, no Material, no
Chakra. HeroUI v3 ships no shadcn-compatible registry, and mixing Radix-based components
into a React Aria codebase splits the token system and the accessibility model in half.

- **Tokens come from `@heroui/styles`** — colour, radius, spacing, elevation. Never
  invent a parallel scale. Brand overrides go in the `:root` block of
  [globals.css](web/app/globals.css), written in `oklch`, and stay short and deliberate.
  Brand values are derived from [DESIGN.md](DESIGN.md), converted — never re-eyeballed.
- **Reach for the HeroUI component first**, and compose it: v3 is compound
  (`<Card><Card.Header><Card.Title>`), not flat props. Use semantic variants
  (`primary`/`secondary`/`tertiary`/`danger`), not raw colours.
- **All of it is modifiable.** HeroUI's defaults are a starting point — restyle,
  wrap, or extend components freely, as long as changes are expressed in HeroUI tokens.
- If HeroUI genuinely lacks a component, hand-write it against HeroUI tokens and React
  Aria. Do not pull in another library to fill the gap.

**v3, not v2** — no `HeroUIProvider`, no `framer-motion`, `onPress` not `onClick`,
`@heroui/react` + `@heroui/styles` (not `@heroui/system`/`@heroui/theme`). Tailwind v4
is mandatory. Import order in `globals.css` is load-bearing: Tailwind, then HeroUI.

Dark mode is class-driven — `.dark` / `[data-theme="dark"]` on `<html>`, matching
HeroUI's own selectors. Never switch the theme on `prefers-color-scheme` alone.

## Backend / API

- **Canonical reference:** the running Scalar UI at `/docs` and the spec at `/openapi.json`.
- **Source of truth:** `backend/src/modules/<domain>/openapi.ts` + `routes.ts` (domains: `places`, `lists`, `library`, `recognitions`).
- **"Which endpoints power screen X?"** → [docs/api-screen-map.md](docs/api-screen-map.md).
- **Envelope:** every response is `{ ok, data, meta, error }`. Auth is a Supabase JWT Bearer token on every request.

## Build / run / test

- **iOS:** build in Xcode. Configs in `ios/Configurations/*.xcconfig`; runtime values (API base URL, Supabase keys) in `ios/Config/*.plist` per environment (Testing/Staging/Production).
  `ios/Config/*.plist` holds real credentials and is **gitignored** — on a fresh clone, copy each `ios/Config/<Env>.plist.example` to `ios/Config/<Env>.plist` and fill in the values before building.
- **Backend dev:** `cd backend && PORT=3001 npx tsx src/index.ts` (allow-listed in `.claude/settings.local.json`). OpenAPI at `localhost:3001/openapi.json`.
- **Web dev:** `cd web && npm run dev` → `localhost:3001`. The backend owns `:3000`, so the web app is pinned to `:3001` in `package.json` and `.claude/launch.json`. `npm run build` / `npm run typecheck` before calling web work done.
- **Integration tests:** `ios/StashhAPITests/` (Swift Testing, `.serialized`). They hit the **real backend** — never mock the API in these. Run a local backend first.

## Conventions

- Branches: `develop` (integration), `master` (production). Match commit style from `git log`.
- Small, root-cause changes — no drive-by refactors, no backwards-compat shims, no speculative abstractions.
- Never commit secrets (`.env*`, plists with real keys).
- Don't reimplement what the platform or the existing abstraction already gives you — extend the chain, theme the native control.
