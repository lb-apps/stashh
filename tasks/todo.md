# Instagram DM assistant — an agent that answers and acts on the sender's Stashh account

Plan written 2026-11-04 (full text: the approved plan in this session). Branch
`feature/instagram-assistant` from `origin/develop`.

**Goal.** Free-form DMs (and quick-reply / postback taps) go to an LLM agent in the backend
(`backend/src/modules/assistant`, Claude Haiku 5.5 via OpenRouter) that answers in the user's
language and acts on their account through tools over the lists/places/recognitions services.
The Instagram service stays thin: it posts the message, gets a reply plan back and renders it as
text + quick replies, carousels and link buttons. Recognition replies stay deterministic and gain
quick replies that hand the follow-up to the agent.

## A. Database
- [x] `20261104120000_assistant_conversations.sql`: `assistant_turns`, `assistant_messages` (RLS on, no policies, cascade from auth.users)
- [x] `20261104120100_instagram_chat.sql`: `instagram_messages.tapped`, `'chat'` intent, per-sender lease in `claim_instagram_messages`, `claim_instagram_sender_messages`
- [x] Regenerate `backend/src/types/database.ts`; update `instagram/src/db/types.ts`

## B. Backend
- [x] `lib/openrouter.ts`: assistant/tool roles, `tools`, `tool_choice`, `tool_calls` parsing, `usage.include`, `cache_control` (+ tests)
- [x] Small additions: `createListsServiceWithServiceRole`, `removePlaceByPlaceId`, `searchSavedPlaces`, `getSavedPlacesByPlaceIds`, `getPlacesByGoogleIds`, `listRecentRecognitionsWithPlaces`, `findProfileByUserId`
- [x] `modules/assistant/`: `tools.ts`, `run-turn.ts`, `context.ts`, `render.ts`, `repository.ts`, `service.ts`, `factory.ts`, `routes.ts`, `openapi.ts`, `types.ts`
- [x] `prompt.md` + generated `prompt.ts` + `npm run assistant:prompt:build` + identity test
- [x] Config: `ASSISTANT_MODEL`, `ASSISTANT_MAX_STEPS`, `ASSISTANT_DAILY_TURN_CAP`; `.env.example`
- [x] Mount `/internal/v1/users/:userId/assistant/turns`; OpenAPI; `docs.ts` import
- [x] Tests: openrouter, prompt, tools, run-turn, render, service

## C. Instagram service
- [x] Inbound: postbacks + quick-reply payloads → `tapped`; store column; `claimSender`
- [x] Intent `chat`; `ERASE_CONFIRM` → erase
- [x] Processor `chat` branch: typing → resolve → `assistantTurn` → `renderPlan` → `reply`; coalescing; 2.5 s debounce; apology on failure
- [x] Graph client: quick replies on text/button, postback buttons; `renderPlan`
- [x] Recognition reply: carousels first, summary last with "Listeye koy" / "Haritamı aç" quick replies
- [x] Copy, fakes, tests

## D. Verification
- [x] `cd backend && npm run typecheck && npm test`; `cd instagram && npm run typecheck && npm test`
- [x] Migrations applied (2026-11-04, via the Supabase MCP); `npm run assistant:turn` scenarios: Turkish and English questions, list and place cards, a tap; 2–5 s, $0.0003–0.0007 per turn, 87 % cached from the second call
- [x] Local end-to-end through the dev instance (`/env dev`): typed questions, a quick-reply tap, a button template with quick replies all accepted by the Send API; replies in 3–12 s
- [x] PR #27 merged (7de50a5); home-server deploy triggered; owner sends `/env prod` and re-tests
- [x] Meta app: `messaging_postbacks` already arrives (real postback captures in `.captures/`; subscriptions are per account, none at app level)

## Review (2026-11-04, during the live test)
- Instagram accepts `quick_replies` on a button template, so the recognition summary keeps its map button and its quick replies in one message.
- Haiku 5.5 anchors on the previous assistant turn: with the account block before the history it re-sent the last answer and cards on the next question. Fix that held: the live block goes right before the newest message with a "answer this one alone" note; a prompt rule alone did not do it.
- The owner's voice call: Gen-Z friend, direct, emoji where they belong (📍 ✅ 🗺️ 😅), exclamation marks allowed when earned. `copy.tr.ts` (the deterministic recognition replies) still speaks the older, emoji-free voice — align it in a follow-up if wanted.
- Presence: the channel now marks the message seen, shows typing while the assistant or a recognition works and renews it every 12 s.
- Per turn: $0.0003–0.0013, 7–8k prompt tokens with ~87 % cached, 2–5 s for the model (plus the 2.5 s debounce).
- Two empty "Deneme" lists on the dev test user are leftovers of the first (repeating) test runs; the delete was declined in auto mode, harmless.

# Next: assistant settings and usage in the ops dashboard

Asked by the owner on 2026-11-04 ("bu agent'in ayarlarını dashboard'da görüp düzenleyemiyor muyuz"). Branch `feature/ops-assistant` from `develop` once PR #27 is in.

- [ ] `assistant_settings` singleton row (`id boolean pk default true check (id)`, `model`, `system_prompt text null` = shipped default, `max_steps`, `daily_turn_cap`, `enabled`, `updated_at` trigger `set_updated_at`); RLS on, service role only
- [ ] Backend reads the row per turn (`factory.ts`: settings over config defaults; prompt = row or `ASSISTANT_PROMPT`); `GET/PUT /internal/v1/ops/assistant/settings`; `GET /internal/v1/ops/assistant?range=` with an `assistant_ops_stats(p_since, p_bucket)` RPC (turns by status per bucket, cost, tokens, cached share, typical and slowest-5 % duration, tool mix, top senders) + latest 60 turns; `GET /internal/v1/ops/assistant/turns/:id` (plan + messages); OpenAPI; tests
- [ ] Ops: `/assistant` page (nav entry): KPIs (turns, cost, typical latency, cache share), charts (turns by status, cost per day, tool mix), latest turns table → detail Sheet (`?id=`) with the conversation and the plan; Settings panel: model `Select` (Haiku 5.5 / GPT-6 Luna, with prices and the forced-tool-choice note), prompt `Textarea` (`npx shadcn add textarea`) with "Reset to shipped default", caps, enabled switch; `sendJson` helper with the service token; route handlers
- [ ] `instagram_ops_stats` counts the `chat` intent; `ops/README.md` and CLAUDE.md ("the one page that writes" → two)

