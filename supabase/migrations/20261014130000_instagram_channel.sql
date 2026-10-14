-- Instagram DM channel: tables owned by the `instagram/` service.
--
-- The channel is its own bounded context. It never reads backend tables, so there
-- are no foreign keys into them: `user_id` and `recognition_id` are ids the backend's
-- internal API handed back. Both tables are service-role only (RLS on, no policies).

-- ── Inbound messages: a durable work queue ──────────────────────────────────
-- The webhook stores each message and returns 200; a worker claims open rows and
-- drives them received → submitted → replied | failed | expired. `mid` dedupes
-- Meta's redeliveries.

create table public.instagram_messages (
  mid text primary key check (length(mid) between 1 and 512),
  account_id text not null,
  sender_id text not null,
  sent_at timestamptz not null,
  text text,
  attachments jsonb not null default '[]'::jsonb,
  -- Raw webhook event, kept for audit and replay; purged with the row after 30 days.
  payload jsonb not null,
  status text not null default 'received'
    check (status in ('received', 'submitted', 'replied', 'failed', 'expired')),
  user_id uuid,
  recognition_id uuid,
  submitted_at timestamptz,
  replies_sent integer not null default 0 check (replies_sent >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'submitted' or (user_id is not null and recognition_id is not null and submitted_at is not null))
);

comment on table public.instagram_messages is
  'Instagram DMs to @stashh and their processing state. Owned by the instagram channel service; purged after 30 days.';

create index instagram_messages_due_idx
  on public.instagram_messages (next_attempt_at)
  where status in ('received', 'submitted');

create index instagram_messages_sender_id_idx
  on public.instagram_messages (sender_id);

create index instagram_messages_created_at_idx
  on public.instagram_messages (created_at);

create trigger instagram_messages_set_updated_at
  before update on public.instagram_messages
  for each row execute function public.set_updated_at();

alter table public.instagram_messages enable row level security;

-- Claims due, unleased open messages for one worker. SKIP LOCKED lets several
-- workers claim concurrently without blocking or double-processing; the lease
-- (`locked_until`) returns a message to the queue if its worker dies mid-step.
create function public.claim_instagram_messages(p_limit integer, p_lease_seconds integer)
returns setof public.instagram_messages
language sql
security invoker
set search_path = ''
as $$
  update public.instagram_messages as m
  set locked_until = now() + make_interval(secs => p_lease_seconds)
  where m.mid in (
    select c.mid
    from public.instagram_messages as c
    where c.status in ('received', 'submitted')
      and c.next_attempt_at <= now()
      and (c.locked_until is null or c.locked_until < now())
    order by c.next_attempt_at
    limit p_limit
    for update skip locked
  )
  returning m.*;
$$;

revoke execute on function public.claim_instagram_messages(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_instagram_messages(integer, integer) to service_role;

-- ── Instagram account access tokens ─────────────────────────────────────────
-- Long-lived Instagram Login tokens last 60 days and must be refreshed by the
-- service, so they live here rather than in an environment variable.

create table public.instagram_accounts (
  account_id text primary key,
  access_token text not null,
  -- Null until the first refresh reports `expires_in`.
  expires_at timestamptz,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.instagram_accounts is
  'Access tokens for the Instagram professional accounts the channel serves. Service role only.';

create trigger instagram_accounts_set_updated_at
  before update on public.instagram_accounts
  for each row execute function public.set_updated_at();

alter table public.instagram_accounts enable row level security;
