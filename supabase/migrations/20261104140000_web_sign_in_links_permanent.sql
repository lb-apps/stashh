-- DM sign-in links no longer expire or get spent.
--
-- A link that worked once for seven days broke every map button the person had already
-- tapped: the second tap, or any tap after a week, landed on "expired". A link now works
-- for as long as its owner exists; erasing the person deletes their links (on delete
-- cascade). Links that were already spent or expired start working again.

alter table public.web_sign_in_links
  drop column expires_at,
  drop column used_at;

comment on table public.web_sign_in_links is
  'Personal web sign-in links sent in a DM. Only the SHA-256 of the code is kept; a link works until its owner is erased.';
