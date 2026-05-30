-- Fix permissions for public form tables.
-- RLS policies already allow anon insert, but table privileges are also required.

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant insert on table public.contact_inquiries to anon, authenticated;
grant insert on table public.volunteer_applications to anon, authenticated;
grant insert on table public.donation_applications to anon, authenticated;
