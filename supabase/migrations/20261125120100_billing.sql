-- Plans, a daily allowance of analyses, and credits.
--
--   billing_settings   one row the owner edits from the ops dashboard: each plan's daily
--                      allowance, each task's reward, and the mock-purchase switch.
--   billing_accounts   one row per person: their plan (and where it came from) and their
--                      credit balance. The row is the lock every charge takes.
--   credit_ledger      every credit that came in or went out, append-only. (user, reason, ref)
--                      is unique, so a grant or a spend can never happen twice.
--   recognition_tasks  gains `charge` (allowance | credit) and `charge_status`
--                      (reserved → charged | released).
--
-- How an analysis is paid for:
--   1. create_recognition_task reserves the allowance (rolling 24 hours) or, when it is used
--      up, one credit; with neither it creates nothing and says when the next free one comes.
--   2. When the task ends, a trigger settles it in the same write: an analysis that found at
--      least one place is charged (a credit leaves the ledger); a failure or an empty result
--      is released and costs nothing.
--
-- Everything here is service role only. People see their plan through the backend.

-- ── Settings ─────────────────────────────────────────────────────────────────

create table public.billing_settings (
  -- A single row: the primary key can only ever be true.
  id boolean primary key default true check (id),
  -- Analyses that found a place, per rolling 24 hours, before credits are spent.
  free_daily_analyses integer not null default 100 check (free_daily_analyses between 0 and 1000),
  premium_daily_analyses integer not null default 300 check (premium_daily_analyses between 0 and 1000),
  -- Credits a task earns once; 0 switches the task off.
  first_list_credits integer not null default 3 check (first_list_credits between 0 and 100),
  first_web_visit_credits integer not null default 3 check (first_web_visit_credits between 0 and 100),
  -- The paywall grants Premium without payment (owner testing). Off in production.
  mock_purchases boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (premium_daily_analyses >= free_daily_analyses)
);

create trigger billing_settings_set_updated_at
  before update on public.billing_settings
  for each row execute function public.set_updated_at();

comment on table public.billing_settings is
  'Plans and credits settings, one row, edited from the ops dashboard and read by the backend. Service role only.';

alter table public.billing_settings enable row level security;
revoke all on table public.billing_settings from anon, authenticated;

insert into public.billing_settings default values;

-- ── Accounts ─────────────────────────────────────────────────────────────────

create table public.billing_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  -- Who set the plan: nobody yet, the mock paywall, the owner from ops, or a purchase.
  plan_source text not null default 'default' check (plan_source in ('default', 'mock', 'admin', 'revenuecat')),
  -- Premium ends here; null = until changed. A lapsed plan reads as free without a job.
  plan_expires_at timestamptz,
  -- The store a purchase came through (PADDLE, APP_STORE …), when there is one.
  store text check (store is null or length(store) between 1 and 40),
  credit_balance integer not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (plan = 'premium' or plan_expires_at is null)
);

create trigger billing_accounts_set_updated_at
  before update on public.billing_accounts
  for each row execute function public.set_updated_at();

comment on table public.billing_accounts is
  'One row per person: plan and credit balance. Created on first use. Service role only.';

alter table public.billing_accounts enable row level security;
revoke all on table public.billing_accounts from anon, authenticated;

-- ── Ledger ───────────────────────────────────────────────────────────────────

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  -- task: a reward; purchase: a credit pack; recognition: an analysis paid with a credit;
  -- admin: the owner, from ops.
  reason text not null check (reason in ('task', 'purchase', 'recognition', 'admin')),
  -- What it was for: the task's name, the store transaction, the recognition task id, or an
  -- ops request id. Unique per person and reason.
  ref text not null check (length(ref) between 1 and 200),
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);

comment on table public.credit_ledger is
  'Every credit in and out, append-only; (user_id, reason, ref) makes each grant and spend idempotent. Service role only.';

alter table public.credit_ledger enable row level security;
revoke all on table public.credit_ledger from anon, authenticated;

create index credit_ledger_created_idx on public.credit_ledger (created_at desc);

-- ── Charges on recognition tasks ─────────────────────────────────────────────

alter table public.recognition_tasks
  add column charge text check (charge in ('allowance', 'credit')),
  add column charge_status text check (charge_status in ('reserved', 'charged', 'released')),
  add constraint recognition_tasks_charge_pair check ((charge is null) = (charge_status is null));

comment on column public.recognition_tasks.charge is
  'What pays for the analysis: the daily allowance or one credit. Null for tasks from before billing.';
comment on column public.recognition_tasks.charge_status is
  'reserved at creation; charged when it found a place, released when it failed or found none.';

-- Allowance in the last 24 hours and open credit reservations, per person.
create index recognition_tasks_owner_charge_idx
  on public.recognition_tasks (owner_user_id, created_at desc)
  where charge_status in ('reserved', 'charged');

-- ── Quota denials, for ops ───────────────────────────────────────────────────

create table public.recognition_quota_denials (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'premium')),
  created_at timestamptz not null default now()
);

comment on table public.recognition_quota_denials is
  'An analysis refused because the allowance and the credits were used up. Service role only.';

alter table public.recognition_quota_denials enable row level security;
revoke all on table public.recognition_quota_denials from anon, authenticated;

create index recognition_quota_denials_created_idx on public.recognition_quota_denials (created_at desc);
create index recognition_quota_denials_user_idx on public.recognition_quota_denials (user_id);

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- The person's account, created on first use, locked for the rest of the transaction.
create function public.lock_billing_account(p_user_id uuid)
returns public.billing_accounts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.billing_accounts;
begin
  insert into public.billing_accounts (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into strict v_account from public.billing_accounts where user_id = p_user_id for update;
  return v_account;
end;
$$;

-- Premium while it has not lapsed.
create function public.billing_effective_plan(p_plan text, p_expires_at timestamptz)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case when p_plan = 'premium' and (p_expires_at is null or p_expires_at > now()) then 'premium' else 'free' end;
$$;

-- Plan, allowance, credits and tasks as people see them.
create function public.billing_status(p_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_settings public.billing_settings;
  v_account public.billing_accounts;
  v_plan text;
  v_limit integer;
  v_used integer;
  v_reserved_credits integer;
  v_next_free_at timestamptz;
begin
  select * into strict v_settings from public.billing_settings where id;
  select * into v_account from public.billing_accounts where user_id = p_user_id;

  v_plan := public.billing_effective_plan(coalesce(v_account.plan, 'free'), v_account.plan_expires_at);
  v_limit := case v_plan when 'premium' then v_settings.premium_daily_analyses else v_settings.free_daily_analyses end;

  select count(*) into v_used
  from public.recognition_tasks
  where owner_user_id = p_user_id
    and charge = 'allowance'
    and charge_status in ('reserved', 'charged')
    and created_at > now() - interval '24 hours';

  select count(*) into v_reserved_credits
  from public.recognition_tasks
  where owner_user_id = p_user_id and charge = 'credit' and charge_status = 'reserved';

  -- The allowance frees up one analysis at a time, 24 hours after each was taken.
  if v_used >= v_limit and v_used > 0 then
    select created_at + interval '24 hours' into v_next_free_at
    from public.recognition_tasks
    where owner_user_id = p_user_id
      and charge = 'allowance'
      and charge_status in ('reserved', 'charged')
      and created_at > now() - interval '24 hours'
    order by created_at
    offset greatest(v_used - v_limit, 0)
    limit 1;
  end if;

  return jsonb_build_object(
    'plan', v_plan,
    'plan_source', coalesce(v_account.plan_source, 'default'),
    'plan_expires_at', case when v_plan = 'premium' then v_account.plan_expires_at end,
    'store', case when v_plan = 'premium' then v_account.store end,
    'daily_limit', v_limit,
    'used_today', least(v_used, v_limit),
    -- Each plan's allowance, for the paywall's comparison.
    'plan_limits', jsonb_build_object('free', v_settings.free_daily_analyses, 'premium', v_settings.premium_daily_analyses),
    'next_free_at', v_next_free_at,
    'credits', greatest(coalesce(v_account.credit_balance, 0) - v_reserved_credits, 0),
    'mock_purchases', v_settings.mock_purchases,
    -- Tasks switched off (0 credits) are left out unless the person already earned them.
    'tasks', (
      select coalesce(jsonb_agg(jsonb_build_object('task', t.task, 'credits', t.credits, 'done', t.done) order by t.ord), '[]'::jsonb)
      from (
        select s.ord, s.task, s.credits,
          exists (
            select 1 from public.credit_ledger l
            where l.user_id = p_user_id and l.reason = 'task' and l.ref = s.task
          ) as done
        from (
          values
            (1, 'first_list', v_settings.first_list_credits),
            (2, 'first_web_visit', v_settings.first_web_visit_credits)
        ) as s (ord, task, credits)
      ) as t
      where t.credits > 0 or t.done
    )
  );
end;
$$;

-- ── Creating a task: reserve the allowance or a credit ───────────────────────

-- Returns {status: "created" | "existing", task} or {status: "quota", plan, daily_limit,
-- used_today, next_free_at, credits}. The account lock serialises one person's requests, so
-- two shares at once cannot both take the last free analysis.
create function public.create_recognition_task(
  p_owner_user_id uuid,
  p_source_url text,
  p_source_media jsonb,
  p_options jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.billing_accounts;
  v_settings public.billing_settings;
  v_plan text;
  v_limit integer;
  v_used integer;
  v_reserved_credits integer;
  v_charge text;
  v_task public.recognition_tasks;
  v_status jsonb;
begin
  v_account := public.lock_billing_account(p_owner_user_id);

  -- A replay of the same message returns its task and is not charged again.
  if p_idempotency_key is not null then
    select * into v_task
    from public.recognition_tasks
    where owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('status', 'existing', 'task', to_jsonb(v_task));
    end if;
  end if;

  select * into strict v_settings from public.billing_settings where id;
  v_plan := public.billing_effective_plan(v_account.plan, v_account.plan_expires_at);
  v_limit := case v_plan when 'premium' then v_settings.premium_daily_analyses else v_settings.free_daily_analyses end;

  select count(*) into v_used
  from public.recognition_tasks
  where owner_user_id = p_owner_user_id
    and charge = 'allowance'
    and charge_status in ('reserved', 'charged')
    and created_at > now() - interval '24 hours';

  if v_used < v_limit then
    v_charge := 'allowance';
  else
    select count(*) into v_reserved_credits
    from public.recognition_tasks
    where owner_user_id = p_owner_user_id and charge = 'credit' and charge_status = 'reserved';

    if v_account.credit_balance - v_reserved_credits >= 1 then
      v_charge := 'credit';
    end if;
  end if;

  if v_charge is null then
    insert into public.recognition_quota_denials (user_id, plan) values (p_owner_user_id, v_plan);
    v_status := public.billing_status(p_owner_user_id);
    return jsonb_build_object(
      'status', 'quota',
      'plan', v_status -> 'plan',
      'daily_limit', v_status -> 'daily_limit',
      'used_today', v_status -> 'used_today',
      'next_free_at', v_status -> 'next_free_at',
      'credits', v_status -> 'credits'
    );
  end if;

  insert into public.recognition_tasks (
    owner_user_id, source_url, source_media, options, idempotency_key, status, retry_count, charge, charge_status
  ) values (
    p_owner_user_id, p_source_url, p_source_media, coalesce(p_options, '{}'::jsonb), p_idempotency_key, 'queued', 0,
    v_charge, 'reserved'
  )
  returning * into v_task;

  return jsonb_build_object('status', 'created', 'task', to_jsonb(v_task));
end;
$$;

-- ── Settling a task when it ends ─────────────────────────────────────────────

create function public.settle_recognition_charge()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_found_places boolean := false;
  v_balance integer;
begin
  if new.status = 'completed' and new.result_id is not null then
    select case when jsonb_typeof(r.places) = 'array' then jsonb_array_length(r.places) > 0 else false end
      into v_found_places
    from public.recognition_results r
    where r.id = new.result_id;
  end if;

  if not coalesce(v_found_places, false) then
    new.charge_status := 'released';
    return new;
  end if;

  if new.charge = 'credit' then
    update public.billing_accounts
    set credit_balance = credit_balance - 1
    where user_id = new.owner_user_id and credit_balance >= 1
    returning credit_balance into v_balance;

    -- The credit went elsewhere since it was reserved (an ops correction): this one is free.
    if not found then
      new.charge_status := 'released';
      return new;
    end if;

    insert into public.credit_ledger (user_id, delta, reason, ref, balance_after)
    values (new.owner_user_id, -1, 'recognition', new.id::text, v_balance);
  end if;

  new.charge_status := 'charged';
  return new;
end;
$$;

create trigger recognition_tasks_settle_charge
  before update of status on public.recognition_tasks
  for each row
  when (
    old.charge_status = 'reserved'
    and old.status is distinct from new.status
    and new.status in ('completed', 'failed', 'cancelled', 'expired')
  )
  execute function public.settle_recognition_charge();

-- ── Credits in, plans set ────────────────────────────────────────────────────

-- Adds (or, for admin, removes) credits once per (user, reason, ref).
-- Returns {granted, balance}; granted is false when this ref was already applied.
create function public.grant_credits(p_user_id uuid, p_delta integer, p_reason text, p_ref text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.billing_accounts;
  v_balance integer;
begin
  if p_reason not in ('task', 'purchase', 'admin') then
    raise exception 'credits cannot be granted for reason %', p_reason using errcode = '22023';
  end if;
  if p_delta = 0 or (p_delta < 0 and p_reason <> 'admin') then
    raise exception 'invalid credit amount %', p_delta using errcode = '22023';
  end if;

  v_account := public.lock_billing_account(p_user_id);

  if exists (select 1 from public.credit_ledger where user_id = p_user_id and reason = p_reason and ref = p_ref) then
    return jsonb_build_object('granted', false, 'balance', v_account.credit_balance);
  end if;

  if v_account.credit_balance + p_delta < 0 then
    raise exception 'the balance is %; cannot remove %', v_account.credit_balance, -p_delta using errcode = '22023';
  end if;

  update public.billing_accounts
  set credit_balance = credit_balance + p_delta
  where user_id = p_user_id
  returning credit_balance into v_balance;

  insert into public.credit_ledger (user_id, delta, reason, ref, balance_after)
  values (p_user_id, p_delta, p_reason, p_ref, v_balance);

  return jsonb_build_object('granted', true, 'balance', v_balance);
end;
$$;

-- A task's reward at today's setting. Returns {granted, credits, balance}; nothing is granted
-- when the task is switched off (0 credits) or was rewarded before.
create function public.claim_task_reward(p_user_id uuid, p_task text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settings public.billing_settings;
  v_credits integer;
  v_result jsonb;
begin
  select * into strict v_settings from public.billing_settings where id;
  v_credits := case p_task
    when 'first_list' then v_settings.first_list_credits
    when 'first_web_visit' then v_settings.first_web_visit_credits
  end;
  if v_credits is null then
    raise exception 'unknown task %', p_task using errcode = '22023';
  end if;
  if v_credits = 0 then
    return jsonb_build_object('granted', false, 'credits', 0, 'balance', null);
  end if;

  v_result := public.grant_credits(p_user_id, v_credits, 'task', p_task);
  return v_result || jsonb_build_object('credits', v_credits);
end;
$$;

-- A list made anywhere (web, the DM assistant) completes the first-list task.
create function public.reward_first_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.claim_task_reward(new.owner_user_id, 'first_list');
  return null;
end;
$$;

revoke execute on function public.reward_first_list() from public, anon, authenticated;

create trigger user_lists_reward_first_list
  after insert on public.user_lists
  for each row execute function public.reward_first_list();

create function public.set_billing_plan(
  p_user_id uuid,
  p_plan text,
  p_source text,
  p_expires_at timestamptz,
  p_store text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.lock_billing_account(p_user_id);
  update public.billing_accounts
  set plan = p_plan,
      plan_source = p_source,
      plan_expires_at = case when p_plan = 'premium' then p_expires_at end,
      store = case when p_plan = 'premium' then p_store end
  where user_id = p_user_id;
  return public.billing_status(p_user_id);
end;
$$;

-- ── Ops ──────────────────────────────────────────────────────────────────────

-- Totals for the window and per-bucket series: analyses by what paid for them, refusals,
-- credits earned and spent, and who is on Premium now.
create function public.billing_ops_stats(p_since timestamptz, p_bucket text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  charged as (
    select date_trunc(p_bucket, created_at) as bucket, charge
    from public.recognition_tasks
    where created_at >= p_since and charge_status = 'charged'
  ),
  denials as (
    select date_trunc(p_bucket, created_at) as bucket, user_id
    from public.recognition_quota_denials
    where created_at >= p_since
  ),
  ledger as (
    select date_trunc(p_bucket, created_at) as bucket, reason, ref, delta
    from public.credit_ledger
    where created_at >= p_since
  ),
  buckets as (
    select generate_series(date_trunc(p_bucket, p_since), date_trunc(p_bucket, now()), ('1 ' || p_bucket)::interval) as bucket
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'premium_people', (
        select count(*) from public.billing_accounts
        where public.billing_effective_plan(plan, plan_expires_at) = 'premium'
      ),
      'analyses_allowance', (select count(*) from charged where charge = 'allowance'),
      'analyses_credit', (select count(*) from charged where charge = 'credit'),
      'refusals', (select count(*) from denials),
      'people_refused', (select count(distinct user_id) from denials),
      'credits_earned', (select coalesce(sum(delta), 0) from ledger where delta > 0),
      'credits_spent', (select coalesce(-sum(delta), 0) from ledger where reason = 'recognition'),
      'credits_held', (select coalesce(sum(credit_balance), 0) from public.billing_accounts)
    ),
    'earned_by', (
      select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'ref', ref, 'credits', credits) order by credits desc), '[]'::jsonb)
      from (
        select reason, case when reason = 'task' then ref else reason end as ref, sum(delta) as credits
        from ledger where delta > 0
        group by 1, 2
      ) e
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', b.bucket,
        'allowance', (select count(*) from charged c where c.bucket = b.bucket and c.charge = 'allowance'),
        'credit', (select count(*) from charged c where c.bucket = b.bucket and c.charge = 'credit'),
        'refusals', (select count(*) from denials d where d.bucket = b.bucket)
      ) order by b.bucket), '[]'::jsonb)
      from buckets b
    )
  );
$$;

-- People for the ops lookup, with their status: by Instagram username, or by exact user id
-- (which also finds people with no Instagram identity, such as the ops test user).
create function public.billing_ops_people(p_query text, p_limit integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', p.user_id,
    'username', p.username,
    'display_name', p.display_name,
    'status', public.billing_status(p.user_id)
  ) order by p.username nulls last), '[]'::jsonb)
  from (
    select u.id as user_id, ci.username, ci.display_name
    from public.users u
    left join public.channel_identities ci on ci.user_id = u.id and ci.provider = 'instagram'
    where u.id::text = p_query
       or ci.username ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by ci.username nulls last
    limit least(greatest(p_limit, 1), 50)
  ) p;
$$;

-- The latest credit movements.
create function public.billing_ops_ledger(p_limit integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'user_id', l.user_id,
    'username', ci.username,
    'delta', l.delta,
    'reason', l.reason,
    'ref', l.ref,
    'balance_after', l.balance_after,
    'created_at', l.created_at
  ) order by l.created_at desc), '[]'::jsonb)
  from (
    select * from public.credit_ledger order by created_at desc limit least(greatest(p_limit, 1), 200)
  ) l
  left join public.channel_identities ci on ci.user_id = l.user_id and ci.provider = 'instagram';
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────

revoke execute on function
  public.lock_billing_account(uuid),
  public.billing_effective_plan(text, timestamptz),
  public.billing_status(uuid),
  public.create_recognition_task(uuid, text, jsonb, jsonb, text),
  public.settle_recognition_charge(),
  public.grant_credits(uuid, integer, text, text),
  public.claim_task_reward(uuid, text),
  public.set_billing_plan(uuid, text, text, timestamptz, text),
  public.billing_ops_stats(timestamptz, text),
  public.billing_ops_people(text, integer),
  public.billing_ops_ledger(integer)
from public, anon, authenticated;

grant execute on function
  public.lock_billing_account(uuid),
  public.billing_effective_plan(text, timestamptz),
  public.billing_status(uuid),
  public.create_recognition_task(uuid, text, jsonb, jsonb, text),
  public.grant_credits(uuid, integer, text, text),
  public.claim_task_reward(uuid, text),
  public.set_billing_plan(uuid, text, text, timestamptz, text),
  public.billing_ops_stats(timestamptz, text),
  public.billing_ops_people(text, integer),
  public.billing_ops_ledger(integer)
to service_role;

-- ── Lists made before billing count for the first-list task ──────────────────

do $$
declare
  v_owner uuid;
begin
  for v_owner in select distinct owner_user_id from public.user_lists loop
    perform public.claim_task_reward(v_owner, 'first_list');
  end loop;
end;
$$;
