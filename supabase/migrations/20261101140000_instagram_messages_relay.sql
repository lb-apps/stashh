-- The hooks relay (hooks.stashh.me, docs/webhook-relay.md) puts production and a dev instance
-- behind Meta's one Instagram callback. Both share this table, so every message records which
-- instance received it, and each instance claims only its own: a dev worker never takes
-- production's messages, production never takes a teammate's routed to dev.
--
-- Stashh has no contacts table, and the channel never reads backend tables (no
-- channel_identities column), so "routed here" is recorded on the message itself, from the relay's
-- sealed envelope: outside production, only a relay-routed message may be answered.
--
-- Additive and zero-downtime: existing rows and the running service's inserts take the defaults
-- (prod, not routed); the old two-argument claim call resolves to the new function's default.

alter table public.instagram_messages
  add column environment text not null default 'prod'
    check (environment in ('dev', 'prod')),
  add column relay_routed boolean not null default false,
  -- The relay's outcome of a `/env` command ({kind, env, from|value|target}); null for an ordinary message.
  add column relay_command jsonb
    check (relay_command is null or jsonb_typeof(relay_command) = 'object');

comment on column public.instagram_messages.environment is
  'The instance that received the message (prod or a developer''s dev) and the only one that claims it.';
comment on column public.instagram_messages.relay_routed is
  'The hooks relay routed it to that instance (sealed envelope). Outside prod, only these are answered.';
comment on column public.instagram_messages.relay_command is
  'What the hooks relay did with this /env command; answered in the chat, never recognized.';

-- A relay /env command is its own intent: answered with the relay's outcome.
alter table public.instagram_messages drop constraint if exists instagram_messages_intent_check;
alter table public.instagram_messages
  add constraint instagram_messages_intent_check
    check (intent in ('recognize', 'help', 'unsupported', 'erase', 'link', 'env'));

drop index if exists public.instagram_messages_due_idx;
create index instagram_messages_due_idx
  on public.instagram_messages (environment, next_attempt_at)
  where status in ('received', 'submitted');

drop function public.claim_instagram_messages(integer, integer);

-- Claims due, unleased open messages of one environment for one worker. SKIP LOCKED lets several
-- workers claim concurrently without blocking or double-processing; the lease (`locked_until`)
-- returns a message to the queue if its worker dies mid-step.
create function public.claim_instagram_messages(p_limit integer, p_lease_seconds integer, p_environment text default 'prod')
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
    where c.environment = p_environment
      and c.status in ('received', 'submitted')
      and c.next_attempt_at <= now()
      and (c.locked_until is null or c.locked_until < now())
    order by c.next_attempt_at
    limit p_limit
    for update skip locked
  )
  returning m.*;
$$;

revoke execute on function public.claim_instagram_messages(integer, integer, text) from public, anon, authenticated;
grant execute on function public.claim_instagram_messages(integer, integer, text) to service_role;
