-- One-time sign-in links for the web app, sent in an Instagram DM.
--
-- People who reach Stashh over Instagram have no password, OAuth login or mailbox: their
-- Auth user is backed by a reserved, never-mailed address. A link in the DM is how they
-- get a web session. The code itself is never stored, only its SHA-256, so a read of this
-- table cannot be replayed into a session. A link works once and for seven days.
--
-- Service role only: RLS is on with no policies; the backend's internal API mints and
-- redeems links.

create table public.web_sign_in_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  check (expires_at > created_at)
);

create index web_sign_in_links_user_id_idx on public.web_sign_in_links (user_id);

alter table public.web_sign_in_links enable row level security;

comment on table public.web_sign_in_links is
  'One-time web sign-in links sent in a DM. Only the SHA-256 of the code is kept; a link is spent on first redeem.';
