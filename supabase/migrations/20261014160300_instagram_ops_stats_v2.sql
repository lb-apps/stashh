-- Instagram channel ops stats, v2. Adds to v1: the previous window (trend badges), reply
-- time per bucket, what people send (Reel, post, link, text, other), how recognitions end
-- (places found, nothing found, apology), and new vs returning senders. Same signature
-- and grants as v1; never returns the access token.

create or replace function public.instagram_ops_stats(p_since timestamptz, p_bucket text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  bounds as (select p_since - (now() - p_since) as previous_since),
  classified as (
    select
      m.*,
      case
        when m.attachments->0->>'type' = 'ig_reel' then 'reel'
        when m.attachments->0->>'type' = 'ig_post' then 'post'
        when jsonb_array_length(m.attachments) > 0 then 'other'
        when m.text ~* 'https?://' then 'link'
        else 'text'
      end as content,
      extract(epoch from (m.finished_at - m.sent_at)) * 1000 as reply_ms
    from public.instagram_messages m
    where m.created_at >= (select previous_since from bounds)
  ),
  messages as (select * from classified where created_at >= p_since),
  previous_messages as (select * from classified where created_at < p_since),
  first_seen as (
    select sender_id, min(created_at) as first_at from public.instagram_messages group by sender_id
  ),
  buckets as (
    select generate_series(date_trunc(p_bucket, p_since), date_trunc(p_bucket, now()), ('1 ' || p_bucket)::interval) as bucket
  ),
  series as (
    select
      b.bucket,
      count(m.mid) as messages,
      count(m.mid) filter (where m.status = 'replied') as replied,
      count(m.mid) filter (where m.status in ('failed', 'expired')) as failed,
      percentile_cont(0.5) within group (order by m.reply_ms) filter (where m.status = 'replied') as reply_p50_ms
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
    'previous', (
      select jsonb_build_object(
        'messages', count(*),
        'senders', count(distinct sender_id),
        'replied', count(*) filter (where status = 'replied'),
        'unanswered', count(*) filter (where status in ('failed', 'expired')),
        'reply_p50_ms', percentile_cont(0.5) within group (order by reply_ms) filter (where status = 'replied')
      )
      from previous_messages
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
    'content_mix', (
      select coalesce(jsonb_agg(jsonb_build_object('content', content, 'count', n) order by n desc), '[]'::jsonb)
      from (select content, count(*) as n from messages group by content) c
    ),
    'outcomes', (
      -- A recognition reply is a summary plus at least one carousel when places were found,
      -- a single text when nothing was found; failures send an apology.
      select jsonb_build_object(
        'with_places', count(*) filter (where status = 'replied' and replies_sent > 1),
        'no_places', count(*) filter (where status = 'replied' and replies_sent = 1),
        'apology', count(*) filter (where status = 'failed'),
        'expired', count(*) filter (where status = 'expired')
      )
      from messages
      where intent = 'recognize' or (intent is null and content in ('reel', 'post', 'link'))
    ),
    'senders', (
      select jsonb_build_object(
        'new', count(distinct m.sender_id) filter (where f.first_at >= p_since),
        'returning', count(distinct m.sender_id) filter (where f.first_at < p_since)
      )
      from messages m
      join first_seen f using (sender_id)
    ),
    'reply', (
      select jsonb_build_object(
        'p50_ms', percentile_cont(0.5) within group (order by reply_ms),
        'p95_ms', percentile_cont(0.95) within group (order by reply_ms)
      )
      from messages
      where status = 'replied'
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'messages', messages, 'replied', replied, 'failed', failed, 'reply_p50_ms', reply_p50_ms
      ) order by bucket), '[]'::jsonb)
      from series
    ),
    'recent_failures', (
      select coalesce(jsonb_agg(f order by f.finished_at desc), '[]'::jsonb)
      from (
        select status, intent, content, attempts, last_error, finished_at
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
