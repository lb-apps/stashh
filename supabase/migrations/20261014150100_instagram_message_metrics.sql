-- What people ask the Instagram channel for, and how long they wait for the answer.
--
-- intent:      what the message was read as on its first step.
-- finished_at: when it reached a final status (replied, failed, expired); reply time
--              is finished_at - sent_at. updated_at cannot stand in for it, because
--              any later write to the row would move it.

alter table public.instagram_messages
  add column intent text check (intent in ('recognize', 'help', 'unsupported', 'erase')),
  add column finished_at timestamptz,
  add constraint instagram_messages_finished_at_check
    check ((status in ('replied', 'failed', 'expired')) = (finished_at is not null)) not valid;

-- Rows settled before this migration have no finish time; give them their last update
-- so the constraint holds, then validate it.
update public.instagram_messages
  set finished_at = updated_at
  where status in ('replied', 'failed', 'expired') and finished_at is null;

alter table public.instagram_messages validate constraint instagram_messages_finished_at_check;

create index instagram_messages_finished_at_idx on public.instagram_messages (finished_at);
