-- Captions scraped before the entity-decoder fix lost the top bits of every emoji
-- above U+FFFF: `&#x1F4CD;` was stored as U+F4CD (private use) instead of 📍.
-- Every such character in a caption lands in U+F000–U+FAFF, and every character
-- found there was one of those emoji (📍 😍 🤍 🍕 🆕 skin tones …), so adding
-- 0x10000 restores the original. Only rows that contain the range are touched.
update public.recognition_results r
set caption = (
  select string_agg(
    case when ascii(t.ch) between 61440 and 64255 then chr(ascii(t.ch) + 65536) else t.ch end,
    '' order by t.i
  )
  from regexp_split_to_table(r.caption, '') with ordinality as t(ch, i)
)
where r.caption ~ '[\uF000-\uFAFF]';
