-- Discovery greenfield schema: users, lists, places, user library, visits, recognitions.

create extension if not exists "pgcrypto";

-- ── Utility functions ─────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_valid_recognition_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status in ('failed', 'cancelled', 'expired', 'committed') then
    raise exception 'Invalid status transition from terminal state % to %', old.status, new.status;
  end if;

  if old.status = 'queued' and new.status in ('processing', 'cancelled', 'expired') then
    return new;
  end if;

  if old.status = 'processing' and new.status in ('queued', 'completed', 'failed', 'cancelled', 'expired') then
    return new;
  end if;

  if old.status = 'completed' and new.status in ('committed', 'cancelled', 'expired') then
    return new;
  end if;

  raise exception 'Invalid status transition from % to %', old.status, new.status;
end;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_username text;
begin
  fallback_username := 'user_' || left(replace(new.id::text, '-', ''), 12);

  insert into public.users (
    id,
    username,
    first_name,
    last_name,
    phone,
    avatar_url
  )
  values (
    new.id,
    fallback_username,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ── Core tables ───────────────────────────────────────────────────────────────

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text,
  name text not null,
  address text,
  city text,
  district text,
  country text,
  location jsonb,
  category text,
  rating numeric(2,1),
  price_level smallint,
  thumbnail_url text,
  website_url text,
  phone_number text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_places (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete restrict,
  personal_note text,
  recommendations jsonb not null default '[]'::jsonb,
  saved_from_source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, place_id),
  unique (id, owner_user_id)
);

create table public.user_visits (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  user_place_id uuid not null references public.user_places (id) on delete cascade,
  visited_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_places (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  user_place_id uuid not null references public.user_places (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, user_place_id),
  foreign key (list_id, owner_user_id) references public.lists (id, owner_user_id) on delete cascade,
  foreign key (user_place_id, owner_user_id) references public.user_places (id, owner_user_id) on delete cascade
);

create table public.recognitions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  source_url text not null,
  results jsonb,
  status text not null default 'queued',
  run_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  claimed_at timestamptz,
  last_transition_at timestamptz not null default now(),
  error_message text,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  status_metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('queued', 'processing', 'completed', 'committed', 'cancelled', 'failed', 'expired')),
  check (retry_count >= 0),
  check (max_retries >= 0)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create unique index places_google_place_id_unique
  on public.places (google_place_id)
  where google_place_id is not null;

create index lists_owner_user_id_idx
  on public.lists (owner_user_id);

create index user_places_owner_user_id_created_at_idx
  on public.user_places (owner_user_id, created_at desc);

create index user_visits_owner_user_id_visited_at_idx
  on public.user_visits (owner_user_id, visited_at desc);

create index user_visits_user_place_id_visited_at_idx
  on public.user_visits (user_place_id, visited_at desc);

create index list_places_owner_user_id_idx
  on public.list_places (owner_user_id);

create index recognitions_owner_status_created_idx
  on public.recognitions (owner_user_id, status, created_at desc);

create index recognitions_worker_claim_idx
  on public.recognitions (status, run_at asc, created_at asc);

create index recognitions_processing_stale_idx
  on public.recognitions (status, claimed_at asc);

create index recognitions_retry_idx
  on public.recognitions (status, retry_count, run_at asc);

create index recognitions_expires_at_idx
  on public.recognitions (expires_at);

create index places_location_latitude_idx
  on public.places (((location ->> 'latitude')::double precision))
  where location ? 'latitude';

create index places_location_longitude_idx
  on public.places (((location ->> 'longitude')::double precision))
  where location ? 'longitude';

-- ── Triggers ──────────────────────────────────────────────────────────────────

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create trigger lists_set_updated_at
before update on public.lists
for each row
execute function public.set_updated_at();

create trigger places_set_updated_at
before update on public.places
for each row
execute function public.set_updated_at();

create trigger user_places_set_updated_at
before update on public.user_places
for each row
execute function public.set_updated_at();

create trigger user_visits_set_updated_at
before update on public.user_visits
for each row
execute function public.set_updated_at();

create trigger list_places_set_updated_at
before update on public.list_places
for each row
execute function public.set_updated_at();

create trigger recognitions_set_updated_at
before update on public.recognitions
for each row
execute function public.set_updated_at();

create trigger recognitions_validate_transition
before update on public.recognitions
for each row
execute function public.ensure_valid_recognition_transition();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.lists enable row level security;
alter table public.places enable row level security;
alter table public.user_places enable row level security;
alter table public.user_visits enable row level security;
alter table public.list_places enable row level security;
alter table public.recognitions enable row level security;

create policy "Users read own users row"
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy "Users update own users row"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users manage own lists"
on public.lists
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Authenticated users can read places"
on public.places
for select
to authenticated
using (true);

create policy "Users manage own user_places"
on public.user_places
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users manage own user_visits"
on public.user_visits
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users manage own list_places"
on public.list_places
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users manage own recognitions"
on public.recognitions
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);
