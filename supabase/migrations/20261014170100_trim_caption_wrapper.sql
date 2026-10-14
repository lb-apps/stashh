-- Instagram's og:description wraps the caption as `…: "<caption>".`; the scraper
-- removed the opening quote but kept the closing `".`. Scraped captions now end
-- cleanly; this trims the wrapper from the ones already stored.
update public.recognition_results
set caption = regexp_replace(caption, '"\.$', '')
where caption ~ '"\.$';
