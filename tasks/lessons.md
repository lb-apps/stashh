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
