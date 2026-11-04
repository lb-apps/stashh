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
- [ ] Migrations applied; `backend/scripts/assistant-turn.ts` scenarios (cached tokens > 0 on the second run)
- [ ] Local end-to-end through the dev instance (`/env dev`), then merge → deploy → real DMs
- [x] Meta app: `messaging_postbacks` already arrives (real postback captures in `.captures/`; subscriptions are per account, none at app level)

## Review
(filled in when done)
