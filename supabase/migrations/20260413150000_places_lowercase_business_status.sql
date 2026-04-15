-- Lowercase all existing business_status values on places table.

update public.places
set business_status = lower(business_status)
where business_status is not null
  and business_status != lower(business_status);
