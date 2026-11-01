-- A new DM intent: "harita" / "link" asks for a fresh sign-in link to the web app.

alter table public.instagram_messages drop constraint if exists instagram_messages_intent_check;
alter table public.instagram_messages
  add constraint instagram_messages_intent_check
    check (intent in ('recognize', 'help', 'unsupported', 'erase', 'link'));
