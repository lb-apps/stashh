-- Channel identities: maps an identity on an external messaging channel (an
-- Instagram-scoped user id today) to the Stashh user that owns its data.
--
-- The Stashh user is a regular auth.users row created server-side by the backend's
-- internal API, so every existing owner_user_id foreign key, RLS policy and cascade
-- applies unchanged. Deleting that auth user removes the identity and everything the
-- person owns (recognitions, saved places, lists) through the existing cascades.

create table public.channel_identities (
  provider text not null check (provider in ('instagram')),
  external_id text not null check (length(external_id) between 1 and 128),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, external_id)
);

create index channel_identities_user_id_idx
  on public.channel_identities (user_id);

comment on table public.channel_identities is
  'External channel identity (e.g. Instagram-scoped id) → owning Stashh user. Written only by the backend internal API (service role).';

-- Service role only: RLS on with no policies denies every client role.
alter table public.channel_identities enable row level security;

-- ── Idempotent recognition creation ─────────────────────────────────────────
-- Channels redeliver events (Meta retries for up to 36 hours). The caller passes
-- its own event id as an idempotency key; a repeat returns the original task.

alter table public.recognition_tasks
  add column idempotency_key text
    check (idempotency_key is null or length(idempotency_key) between 1 and 255);

create unique index recognition_tasks_owner_idempotency_key_key
  on public.recognition_tasks (owner_user_id, idempotency_key)
  where idempotency_key is not null;
