-- Free-form DMs go to the assistant. Three changes to the Instagram queue:
--
--   1. A tap on a quick reply or a template button arrives with a payload; it is kept on the
--      message (`tapped`) so the worker can act on it without re-reading the raw event.
--   2. `chat` is an intent of its own: anything that is not a share, a link or a command.
--   3. One sender's messages are worked on one at a time and in order, so a conversation
--      never answers out of sequence and quick follow-ups fold into one turn.

alter table public.instagram_messages
  add column tapped jsonb
    check (tapped is null or jsonb_typeof(tapped) = 'object');

comment on column public.instagram_messages.tapped is
  'The quick reply or button the person tapped ({title, payload}); null for a typed message.';

alter table public.instagram_messages drop constraint if exists instagram_messages_intent_check;
alter table public.instagram_messages
  add constraint instagram_messages_intent_check
    check (intent in ('recognize', 'help', 'unsupported', 'erase', 'link', 'env', 'chat'));

-- Finds a sender's live lease quickly; most rows have none, so the index stays tiny.
create index instagram_messages_sender_lease_idx
  on public.instagram_messages (sender_id)
  where locked_until is not null;

-- Same claim as before, plus: a message is skipped while another message of the same sender
-- is leased, so one sender is handled by one worker at a time, oldest message first.
create or replace function public.claim_instagram_messages(p_limit integer, p_lease_seconds integer, p_environment text default 'prod')
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
      and not exists (
        select 1
        from public.instagram_messages as l
        where l.sender_id = c.sender_id
          and l.mid <> c.mid
          and l.locked_until > now()
      )
    order by c.next_attempt_at, c.sent_at
    limit p_limit
    for update skip locked
  )
  returning m.*;
$$;

-- Leases every other open, unleased message of one sender that is due now, oldest first, so
-- a worker already holding one of the sender's messages can fold the rest into the same turn.
create function public.claim_instagram_sender_messages(p_sender_id text, p_lease_seconds integer, p_environment text default 'prod')
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
      and c.sender_id = p_sender_id
      and c.status = 'received'
      and c.next_attempt_at <= now()
      and (c.locked_until is null or c.locked_until < now())
    order by c.sent_at
    for update skip locked
  )
  returning m.*;
$$;

revoke execute on function public.claim_instagram_sender_messages(text, integer, text) from public, anon, authenticated;
grant execute on function public.claim_instagram_sender_messages(text, integer, text) to service_role;
