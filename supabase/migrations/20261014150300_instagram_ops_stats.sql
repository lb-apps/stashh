-- Ops stats for the Instagram channel, in one round trip.
--
-- Read by the channel's own ops endpoint (service role only). Window figures cover
-- messages stored since p_since; `live` is the queue right now. Messages are purged
-- after 30 days, so no window reaches further back. Never returns the access token.

create function public.instagram_ops_stats(p_since timestamptz, p_bucket text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  messages as (
    select m.* from public.instagram_messages m where m.created_at >= p_since
  ),
  buckets as (
    select generate_series(
      date_trunc(p_bucket, p_since),
      date_trunc(p_bucket, now()),
      ('1 ' || p_bucket)::interval
    ) as bucket
  ),
  series as (
    select
      b.bucket,
      count(m.mid) as messages,
      count(m.mid) filter (where m.status = 'replied') as replied,
      count(m.mid) filter (where m.status in ('failed', 'expired')) as failed
    from buckets b
    left join messages m on date_trunc(p_bucket, m.created_at) = b.bucket
    group by b.bucket
  )
  select jsonb_build_object(
    'live', (
      select jsonb_build_object(
        'received', count(*) filter (where status = 'received'),
        'submitted', count(*) filter (where status = 'submitted'),
        'oldest_open_at', min(created_at)
      )
      from public.instagram_messages
      where status in ('received', 'submitted')
    ),
    'totals', (
      select jsonb_build_object(
        'messages', count(*),
        'senders', count(distinct sender_id),
        'replied', count(*) filter (where status = 'replied'),
        'failed', count(*) filter (where status = 'failed'),
        'expired', count(*) filter (where status = 'expired'),
        'open', count(*) filter (where status in ('received', 'submitted')),
        'retried', count(*) filter (where attempts > 0)
      )
      from messages
    ),
    'intents', (
      select jsonb_build_object(
        'recognize', count(*) filter (where intent = 'recognize'),
        'help', count(*) filter (where intent = 'help'),
        'unsupported', count(*) filter (where intent = 'unsupported'),
        'erase', count(*) filter (where intent = 'erase'),
        'unknown', count(*) filter (where intent is null)
      )
      from messages
    ),
    'reply', (
      select jsonb_build_object(
        'p50_ms', percentile_cont(0.5) within group (order by extract(epoch from (finished_at - sent_at)) * 1000),
        'p95_ms', percentile_cont(0.95) within group (order by extract(epoch from (finished_at - sent_at)) * 1000)
      )
      from messages
      where status = 'replied'
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'messages', messages, 'replied', replied, 'failed', failed
      ) order by bucket), '[]'::jsonb)
      from series
    ),
    'recent_failures', (
      select coalesce(jsonb_agg(f order by f.finished_at desc), '[]'::jsonb)
      from (
        select status, intent, attempts, last_error, finished_at
        from messages
        where status in ('failed', 'expired')
        order by finished_at desc
        limit 10
      ) f
    ),
    'account', (
      select jsonb_build_object('expires_at', expires_at, 'refreshed_at', refreshed_at)
      from public.instagram_accounts
      order by updated_at desc
      limit 1
    )
  );
$$;

revoke execute on function public.instagram_ops_stats(timestamptz, text) from public, anon, authenticated;
grant execute on function public.instagram_ops_stats(timestamptz, text) to service_role;
