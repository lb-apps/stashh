-- Channel identity profiles: the person's public handle on the channel, so a Stashh
-- user who only ever wrote to us over Instagram can be found and shown by name.
--
-- The external id stays the key: Instagram usernames change and are reused, so a
-- username is a display value refreshed from the channel, never an identifier — hence
-- no unique constraint. The channel service fetches the profile (it holds the Graph
-- token) and hands it to the backend's internal API, which writes these columns.

alter table public.channel_identities
  add column username text
    check (username is null or username ~ '^[A-Za-z0-9._]{1,30}$'),
  add column display_name text
    check (display_name is null or length(display_name) between 1 and 200),
  -- When the channel last returned a profile; null until the first one.
  add column profile_synced_at timestamptz;

comment on column public.channel_identities.username is
  'Handle on the channel (Instagram username) as last seen. Changes and can be reused; never an identifier.';
comment on column public.channel_identities.display_name is
  'Profile name on the channel as last seen; null when the person has none.';
