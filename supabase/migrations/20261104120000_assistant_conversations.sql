-- The DM assistant: an LLM agent (backend/src/modules/assistant) that answers free-form
-- messages on a channel and acts on the sender's account through tools. Two tables, both
-- written only by the backend's internal API with the service role:
--
--   assistant_turns     one row per model turn: what it cost, how many steps, which tools,
--                       and the reply plan it produced, so a retried request replays the same
--                       plan instead of running the model again.
--   assistant_messages  the conversation as the model sees it on the next turn: the person's
--                       messages and the assistant's replies (text plus a short note of any
--                       cards or buttons), per user and channel.
--
-- Both hang off auth.users, so erasing a channel identity removes them with everything else.

create table public.assistant_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('instagram')),
  model text,
  provider text,
  -- replied: the model called reply · fallback: it never did, a fixed line was sent ·
  -- capped: the sender hit the daily cap, no model call · failed: the turn threw
  status text not null check (status in ('replied', 'fallback', 'capped', 'failed')),
  steps integer not null default 0 check (steps >= 0),
  prompt_tokens integer,
  completion_tokens integer,
  cached_tokens integer,
  cost_usd numeric(12, 8),
  duration_ms integer,
  tool_names text[] not null default '{}',
  error text,
  -- The rendered reply, as handed to the channel ({messages: [...]}); replayed on a retry.
  plan jsonb check (plan is null or jsonb_typeof(plan) = 'object'),
  created_at timestamptz not null default now()
);

create index assistant_turns_user_created_idx
  on public.assistant_turns (user_id, channel, created_at desc);

comment on table public.assistant_turns is
  'One DM assistant turn: model usage, cost, tools and the reply plan. Service role only.';

alter table public.assistant_turns enable row level security;

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('instagram')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- What went with an assistant reply besides text (cards, quick replies, a map link), as a
  -- short note for the model's history; null for plain text and for user messages.
  rich jsonb check (rich is null or jsonb_typeof(rich) = 'object'),
  -- The channel's id of a user message (the Instagram mid); the turn is replayed for a repeat.
  external_message_id text check (external_message_id is null or length(external_message_id) between 1 and 512),
  turn_id uuid references public.assistant_turns (id) on delete set null,
  created_at timestamptz not null default now()
);

create index assistant_messages_user_created_idx
  on public.assistant_messages (user_id, channel, created_at desc);

create unique index assistant_messages_external_id_key
  on public.assistant_messages (channel, external_message_id)
  where external_message_id is not null;

comment on table public.assistant_messages is
  'DM assistant conversation history (user and assistant messages) per user and channel. Service role only.';

alter table public.assistant_messages enable row level security;
