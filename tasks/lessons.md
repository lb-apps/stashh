# Lessons

Patterns extracted from user corrections. Reviewed at session start.

## 2026-08-25 — Don't install a second component library to satisfy a tooling mention

**Correction:** "shadcn yanlış, heroui library kullanacağız."

**What happened:** The request named both shadcn and HeroUI. I treated "install shadcn"
as a hard requirement, discovered the two libraries are architecturally incompatible
(shadcn = Radix + CVA, HeroUI v3 = React Aria + tailwind-variants), and invented a
blended ruling: HeroUI for tokens, shadcn CLI kept around for "gap-filling". The user
wanted one library.

**Why it was wrong:** When a request names two overlapping tools and one is explicitly
made the source of truth for tokens *and* component base, that clause is the decision —
the other name is context, not a second requirement. Layering both in "just in case" is
speculative architecture, exactly what this repo's CLAUDE.md forbids ("no speculative
abstractions"). It also doubles the dependency surface for zero delivered value.

**How to apply:** When two libraries in one request cannot coexist cleanly, stop and ask
which one wins *before* installing either. Do not resolve the conflict by adopting both.
Prefer one library end-to-end; a component the library lacks gets hand-written against
that library's tokens.

**Cost of the miss:** low — caught before `shadcn init` ran, so no dependencies or
`components.json` landed. Only the plan file needed rewriting.

## 2026-10-14 — Don't add test infrastructure the owner's setup doesn't need

**Correction:** "test diye ayrı bir şeye gerek yok bu proje için" / "app'i kullanacak hesap da sadece bu".

**What happened:** For the Instagram DM channel I planned a second Instagram account as an
Instagram Tester and recommended separate dev and prod Meta apps — the generic "safe" setup
from Meta's docs.

**Why it was wrong:** The app serves exactly one account the owner controls, and the owner
tests by messaging it from a personal account. A tester account and a second app add setup,
secrets and drift for no gain. The one role Meta actually requires (the serving account as
Instagram Tester, to generate its token) is not a test setup.

**How to apply:** Before proposing staging/test duplicates (accounts, apps, projects), check
who the system serves and how the owner already tests. Default to the single real setup and
add duplicates only when a concrete risk demands it — and name that risk.

## 2026-10-14 — Untracking a file: back it up before switching branches

**What happened:** `.claude/settings.local.json` was untracked (`git rm --cached`) on a feature
branch while `develop` still tracked it. After the PR merged, `git checkout develop` overwrote the
now-ignored local file with develop's committed copy (git replaces ignored files without asking),
and the fast-forward pull that brought in the deletion removed it from disk. The owner's
uncommitted permissions and MCP server approvals were lost; only the committed version survived.

**How to apply:** When a change untracks a file that must keep living on disk, copy it to the
scratchpad before any checkout, pull or merge, and restore it afterwards. Check the file still
exists after switching branches before reporting the switch as done.

## 2026-10-14 — Design source for new surfaces
- **Mistake:** built the ops dashboard's palette and design language from `web/lib/discovery/tokens`, but the current Stashh design lives in a Claude Design project ("Stashh - stack lists", claude.ai/design/p/16d56bb0-…).
- **Rule:** before styling a new surface, confirm with the user which design source is current; repo tokens can lag the design project. If the project link can't be opened (no claude.ai session in the browser pane, no `/design-login`), ask for access before styling, not after.

## 2026-10-14 — Tailwind v4 focus outlines
- **Mistake:** `focus-visible:outline-3` on elements whose base has `outline-none` rendered no
  ring — v4's `outline-none` sets `--tw-outline-style: none`, which the width utility inherits.
- **Rule:** pair it with `focus-visible:outline-solid`, and check focus with the keyboard
  (computed `outline-style`), not by reading class names.

## 2026-10-14 — Custom Tailwind scales and class merging
- **Mistake:** added `text-display` / `rounded-card`; the shadcn `cn` (tailwind-merge
  semantics) treated `text-display` as a colour and dropped it beside `text-foreground`.
- **Rule:** when adding a theme scale, extend `cn`'s config (`createCn({ extend })`) in the same
  change and test a merge of the new class against its neighbours.

## 2026-10-14 — "Slowness" is the user's symptom, not a list of every delay
- **Mistake:** asked about HomeKit lights feeling slow, I counted the lights' deliberate 1 s fade
  (`transition: 1`) as part of the problem and removed it once the user said "do both". The user
  meant system latency (command → light starts reacting); the fade was a chosen look.
- **Rule:** separate configured behaviour (fades, delays, schedules) from faults before offering
  fixes, and say which bucket each finding is in. Only offer to change a deliberate setting as an
  explicit, separately named option — never bundle it with fault fixes.

## 2026-10-14 — Following a kit vs. what the owner already approved
- **Mistake:** copied the console kit's docked run panel, replacing the detail dialog the owner
  had already approved; they wanted the dialog back.
- **Rule:** a design-kit pass restyles; it does not change an approved interaction (dialog vs
  docked, page vs sheet) without asking. List such behaviour changes in the plan as a question.

## 2026-10-14 — "Light only" must be enforced, not assumed
- **Mistake:** the ops console was declared light-only, but Tailwind v4's `dark:` follows
  `prefers-color-scheme` by default. On the owner's dark-mode Mac every shadcn `dark:` class
  applied (search field at 30% opacity), so greys on greys lost contrast. Testing in a light
  browser profile hid it.
- **Rule:** in a light-only app, pin `@custom-variant dark` to an unused class on day one; audit
  contrast with the computed background behind each text node, and test with the OS in dark mode.
