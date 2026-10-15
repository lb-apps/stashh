-- A list post shared from a DM arrives as its first slide only (Meta sends nothing else), so
-- the model may see "15 places" announced and no names. The result says so, and the channel
-- asks for the post's link instead of answering "nothing found".
alter table public.recognition_results
  add column if not exists names_elsewhere boolean not null default false;

comment on column public.recognition_results.names_elsewhere is
  'The post presents several venues whose names were not in the media and caption read: a list post seen by its cover only. With an empty places, the person is asked for the post link.';
