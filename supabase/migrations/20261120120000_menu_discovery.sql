-- Menu discovery: tables for storing parsed menus from any venue type
-- Supports multiple menus per place (food, drinks, services, etc.)

alter table places add column if not exists menu_url text;

-- A discovered menu source for a place
create table place_menus (
  id              uuid primary key default gen_random_uuid(),
  place_id        uuid not null references places(id) on delete cascade,
  source_url      text not null,
  source_type     text not null,
  menu_type       text not null,
  language        text not null default 'tr',
  status          text not null default 'queued',
  error_message   text,
  retry_count     smallint not null default 0,
  discovered_at   timestamptz,
  scraped_at      timestamptz,
  parsed_at       timestamptz,
  verified_at     timestamptz,
  next_scrape_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_place_menus_place_id on place_menus(place_id);
create index idx_place_menus_status on place_menus(status) where status not in ('done', 'not_found');
create index idx_place_menus_next_scrape on place_menus(next_scrape_at) where status = 'done';

create table menu_categories (
  id              uuid primary key default gen_random_uuid(),
  menu_id         uuid not null references place_menus(id) on delete cascade,
  name            text not null,
  name_en         text,
  description     text,
  description_en  text,
  image_url       text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_menu_categories_menu_id on menu_categories(menu_id);

create table menu_items (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references menu_categories(id) on delete cascade,
  name                text not null,
  name_en             text,
  description         text,
  description_en      text,
  price               numeric(10,2),
  currency            text not null default 'TRY',
  image_url           text,
  original_image_url  text,
  is_available        boolean not null default true,
  sort_order          integer not null default 0,
  tags                text[],
  portion_info        text,
  created_at          timestamptz not null default now()
);

create index idx_menu_items_category_id on menu_items(category_id);

-- Worker queue: claim one queued task atomically (FOR UPDATE SKIP LOCKED)
create or replace function claim_menu_task()
returns place_menus
language sql
volatile
as $$
  update place_menus
  set status = 'discovering', updated_at = now()
  where id = (
    select id from place_menus
    where status = 'queued'
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
$$;
