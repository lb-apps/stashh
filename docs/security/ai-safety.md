# AI safety: what strangers can and cannot make Stashh's models do

Two models read text Stashh does not control. Prompts lower the odds that a model obeys an
injected instruction, but published adaptive attacks get past every prompt-level defense
("The Attacker Moves Second", Oct 2025). So the boundary is deterministic code after the model:
whatever a model is talked into, the code decides what reaches a person or changes data.

## The two models

| Model | Reads | Can change |
|---|---|---|
| Recognition analyzer (`backend/src/modules/recognitions/ai-analyzer.ts`) | A stranger's post: caption, slides, video frames, on-screen text, speech | Which venues are searched on Google, the tips stored with them (cached per URL, shown to every user who shares that post) |
| DM assistant (`backend/src/modules/assistant/`) | The sender's messages, their account, and through `get_place` the tips a post's author wrote | The sender's own lists and places, through tools scoped to `owner_user_id` |

DM routing in `instagram/src/conversation/intent.ts` is plain code: a share is recognized, a tap
on the erase button erases, everything else goes to the assistant.

## Layers

1. **Input hygiene** (`backend/src/lib/untrusted-text.ts`). Unicode tag characters (ASCII
   smuggling), runs of variation selectors (emoji smuggling), bidi overrides, zero-width fillers
   and control characters are removed from every caption, DM and stored tip before a model reads
   it. Flags, emoji sequences, ZWJ/ZWNJ and direction marks stay. Nothing language-specific.
   Lengths are capped: caption 4,000, one DM 2,000, a turn 4,000, a replayed history row 1,000.
2. **Spotlighting.** The caption sits between `<<<CAPTION id>>>` markers whose id is random per
   call, and the task is restated after it. Post-authored fields in tool results carry the suffix
   `_untrusted`. Both prompts have a Security section that ranks above anything in the data.
3. **Output validation for the analyzer.** The JSON is parsed with zod, never cast. At most 30
   venues and 5 tips each, bounded field lengths, hidden characters removed. A tip carrying a
   link, phone, e-mail, @handle or wallet is dropped. If the post speaks to an AI
   (`addresses_the_ai`), none of its tips are kept. Venues still have to match a Google place by
   name, so an invented venue goes nowhere.
4. **Output validation for the assistant** (`run-turn.ts` `parseReply`). A link, phone or e-mail
   in the reply has to be one a tool returned this turn, outside `_untrusted` fields, or
   `stashh.me`. If not, the reply goes back to the model to rewrite. Tool calls that come beside a
   `reply` run first, and the model replies again, so the reply never claims an action that did
   not happen.
5. **Code-owned confirmations.** Deleting a list, removing a place and erasing data are
   irreversible. The model sets `reply.confirm`, and `render.ts` writes both buttons with fixed
   titles ("Evet, listeyi sil" / "Yes, erase my data" + cancel) and payloads
   (`CONFIRM:<action>:<id>`, `ERASE_CONFIRM`). The model cannot write those payloads (schema
   refusal). `delete_list` / `remove_place` run only when the channel reports a real tap on that
   exact button in the same turn. A typed "[tapped …]" is defused text.
6. **Least privilege and caps.** Every tool is scoped to the sender. 60 assistant turns a day per
   user (`assistant_settings.daily_turn_cap`), and 100 recognitions a day per user
   (`RECOGNITIONS_DAILY_CAP`, `429 RECOGNITION_QUOTA`, a fixed DM line). Per-minute rate limits on
   both APIs.

## Rules for new work

- A new tool that cannot be undone gets a `confirm` action and a tap check, never a prompt rule.
- Text that someone other than the sender wrote is passed through `cleanUntrustedText` and goes
  to the model under a key ending in `_untrusted`.
- Free text a model writes and Stashh shows is bounded and checked with `findContactTokens`.
- A new model that reads outside content gets a fenced input, a Security section in its prompt
  and a case in the red team.

## Red team

`cd backend && npm run security:redteam` runs 15 assistant attacks (each 3×,
`REDTEAM_REPEATS`) and 10 analyzer attacks against the real models. In-memory fakes stand behind
the tools, so nothing is written. It covers DAN and role-play, developer mode, fake system tags,
policy puppetry, forged taps, poisoned tips, Arabic, Russian and Japanese injections, tag
smuggling, base64, claimed staff, the grandma exploit, prompt and tool enumeration, injected
links and phones, a fake JSON close, abusive-tip requests, and a venue flood.

Results on 2026-11-04 (Haiku 5.5 assistant, Gemini 3.8 Flash analyzer):

| | Breaches before | Breaches after |
|---|---|---|
| Assistant, 45 runs | 4 (3× a forged tap marker made it "delete" a list, 1 false positive) | 0 |
| Analyzer, 10 runs | 1 (80 venues from one caption) | 0 |

Run it after any prompt or model change, and add a case when a new technique appears.

## Not done, and why

- One model call per slide (it blunts payload splitting across slides) would double cost and lose
  carousel context. Layers 3 and 5 limit what a split payload can achieve.
- Resizing images ourselves against the image-scaling attack would add a native dependency.
  Output validation limits what a hidden prompt in an image can achieve.
- Third-party injection classifiers (Prompt Guard 2, OpenRouter's regex guardrails) are evaded by
  the smuggling techniques above. They would add a signal, not a boundary.
- Owner action: set a daily budget limit on the OpenRouter key, as a hard stop on spend.
