-- The DM assistant's settings and its ops view.
--
--   assistant_settings  one row the owner edits from the ops dashboard: the model, the system
--                       prompt (null = the one shipped in the backend), the step and daily caps,
--                       whether next-step quick replies are offered, and an off switch. The
--                       backend reads it on every turn, so a change applies within seconds and
--                       nothing needs a deploy.
--   assistant_ops_*     what the dashboard's Assistant page shows: turns by status per bucket,
--                       cost, tokens and cache share, typical and slowest-5 % durations, the tool
--                       mix, the latest turns, and one turn in full with its conversation.

create table public.assistant_settings (
  -- A single row: the primary key can only ever be true.
  id boolean primary key default true check (id),
  -- An OpenRouter model id that takes a forced tool choice (Haiku 5.5, GPT-6 Luna).
  model text not null default 'anthropic/claude-haiku-5.5' check (length(model) between 1 and 200),
  -- The whole system prompt; null means the one shipped in the backend (prompt.md).
  system_prompt text check (system_prompt is null or length(system_prompt) between 1 and 60000),
  max_steps integer not null default 6 check (max_steps between 1 and 12),
  daily_turn_cap integer not null default 60 check (daily_turn_cap between 1 and 10000),
  -- Next-step quick replies under answers; confirm / cancel chips stay on either way.
  suggested_replies boolean not null default false,
  -- Off: the channel gets a fixed "not now" line and no model is called.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger assistant_settings_set_updated_at
  before update on public.assistant_settings
  for each row execute function public.set_updated_at();

comment on table public.assistant_settings is
  'The DM assistant''s settings, one row, edited from the ops dashboard and read by the backend on every turn. Service role only.';

alter table public.assistant_settings enable row level security;

insert into public.assistant_settings default values;

-- The ops stats read every turn in a window; the existing index leads with user_id.
create index assistant_turns_created_idx
  on public.assistant_turns (created_at desc);

-- ── Stats for the dashboard ─────────────────────────────────────────────────

create function public.assistant_ops_stats(p_since timestamptz, p_bucket text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select p_since as since, p_since - (now() - p_since) as previous_since
  ),
  turns as (
    select t.* from public.assistant_turns t, bounds b where t.created_at >= b.since
  ),
  previous as (
    select t.* from public.assistant_turns t, bounds b where t.created_at >= b.previous_since and t.created_at < b.since
  ),
  buckets as (
    select generate_series(date_trunc(p_bucket, p_since), date_trunc(p_bucket, now()), ('1 ' || p_bucket)::interval) as bucket
  ),
  series as (
    select
      b.bucket,
      count(t.id) filter (where t.status = 'replied') as replied,
      count(t.id) filter (where t.status = 'fallback') as fallback,
      count(t.id) filter (where t.status = 'capped') as capped,
      count(t.id) filter (where t.status = 'failed') as failed,
      coalesce(sum(t.cost_usd), 0) as cost_usd,
      count(distinct t.user_id) as senders
    from buckets b
    left join turns t on date_trunc(p_bucket, t.created_at) = b.bucket
    group by b.bucket
  ),
  tools as (
    select tool as name, count(*) as uses
    from turns, unnest(turns.tool_names) as tool
    group by tool
    order by uses desc
    limit 12
  ),
  models as (
    select model as name, count(*) as turns, coalesce(sum(cost_usd), 0) as cost_usd
    from turns
    where model is not null
    group by model
    order by turns desc
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'turns', count(*),
        'replied', count(*) filter (where status = 'replied'),
        'fallback', count(*) filter (where status = 'fallback'),
        'capped', count(*) filter (where status = 'capped'),
        'failed', count(*) filter (where status = 'failed'),
        'senders', count(distinct user_id),
        'cost_usd', coalesce(sum(cost_usd), 0),
        'prompt_tokens', coalesce(sum(prompt_tokens), 0),
        'completion_tokens', coalesce(sum(completion_tokens), 0),
        'cached_tokens', coalesce(sum(cached_tokens), 0),
        'steps_avg', avg(steps),
        'typical_ms', percentile_cont(0.5) within group (order by duration_ms),
        'slow_ms', percentile_cont(0.95) within group (order by duration_ms)
      )
      from turns
    ),
    'previous', (
      select jsonb_build_object(
        'turns', count(*),
        'senders', count(distinct user_id),
        'cost_usd', coalesce(sum(cost_usd), 0),
        'failed', count(*) filter (where status = 'failed')
      )
      from previous
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'replied', replied, 'fallback', fallback, 'capped', capped, 'failed', failed,
        'cost_usd', cost_usd, 'senders', senders
      ) order by bucket), '[]'::jsonb)
      from series
    ),
    'tools', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'uses', uses) order by uses desc), '[]'::jsonb) from tools
    ),
    'models', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'turns', turns, 'cost_usd', cost_usd) order by turns desc), '[]'::jsonb) from models
    )
  );
$$;

revoke execute on function public.assistant_ops_stats(timestamptz, text) from public, anon, authenticated;
grant execute on function public.assistant_ops_stats(timestamptz, text) to service_role;

-- ── The latest turns ────────────────────────────────────────────────────────

create function public.assistant_ops_list(p_limit integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'user_id', x.user_id,
    'username', x.username,
    'status', x.status,
    'steps', x.steps,
    'model', x.model,
    'cost_usd', x.cost_usd,
    'duration_ms', x.duration_ms,
    'prompt_tokens', x.prompt_tokens,
    'cached_tokens', x.cached_tokens,
    'tool_names', x.tool_names,
    'error', x.error,
    'question', x.question,
    'answer', x.answer,
    'created_at', x.created_at
  ) order by x.created_at desc), '[]'::jsonb)
  from (
    select
      t.id, t.user_id, c.username, t.status, t.steps, t.model, t.cost_usd, t.duration_ms, t.prompt_tokens, t.cached_tokens,
      t.tool_names, t.error, t.created_at,
      (select m.content from public.assistant_messages m where m.turn_id = t.id and m.role = 'user' order by m.created_at limit 1) as question,
      (select m.content from public.assistant_messages m where m.turn_id = t.id and m.role = 'assistant' order by m.created_at desc limit 1) as answer
    from public.assistant_turns t
    left join public.channel_identities c on c.user_id = t.user_id and c.provider = t.channel
    order by t.created_at desc
    limit p_limit
  ) x;
$$;

revoke execute on function public.assistant_ops_list(integer) from public, anon, authenticated;
grant execute on function public.assistant_ops_list(integer) to service_role;

-- ── One turn in full ────────────────────────────────────────────────────────

create function public.assistant_ops_detail(p_turn_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id,
    'user_id', t.user_id,
    'username', c.username,
    'display_name', c.display_name,
    'channel', t.channel,
    'status', t.status,
    'steps', t.steps,
    'model', t.model,
    'provider', t.provider,
    'prompt_tokens', t.prompt_tokens,
    'completion_tokens', t.completion_tokens,
    'cached_tokens', t.cached_tokens,
    'cost_usd', t.cost_usd,
    'duration_ms', t.duration_ms,
    'tool_names', t.tool_names,
    'error', t.error,
    'plan', t.plan,
    'created_at', t.created_at,
    -- The turn's own messages, and the 10 before them: what the model saw as recent history.
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'role', m.role, 'content', m.content, 'rich', m.rich, 'turn_id', m.turn_id, 'created_at', m.created_at
      ) order by m.created_at, m.role desc), '[]'::jsonb)
      from (
        (select * from public.assistant_messages m where m.turn_id = t.id)
        union all
        (select * from public.assistant_messages m
          where m.user_id = t.user_id and m.channel = t.channel and m.turn_id is distinct from t.id and m.created_at < t.created_at
          order by m.created_at desc limit 10)
      ) m
    )
  ) end
  from (select p_turn_id as id) wanted
  left join public.assistant_turns t on t.id = wanted.id
  left join public.channel_identities c on c.user_id = t.user_id and c.provider = t.channel;
$$;

revoke execute on function public.assistant_ops_detail(uuid) from public, anon, authenticated;
grant execute on function public.assistant_ops_detail(uuid) to service_role;
