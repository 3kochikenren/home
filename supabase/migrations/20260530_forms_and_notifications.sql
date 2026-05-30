-- Form submissions: contact, volunteer, donation
-- Run this migration in Supabase SQL Editor or CLI.

create table if not exists public.contact_inquiries (
    id bigint generated always as identity primary key,
    name text not null,
    email text not null,
    phone text,
    subject text not null,
    message text not null,
    source_page text,
    created_at timestamptz not null default now()
);

create table if not exists public.volunteer_applications (
    id bigint generated always as identity primary key,
    name text not null,
    email text not null,
    phone text,
    area text,
    activity_type text not null,
    message text,
    source_page text,
    created_at timestamptz not null default now()
);

create table if not exists public.donation_applications (
    id bigint generated always as identity primary key,
    name text not null,
    email text not null,
    phone text,
    amount_yen integer not null check (amount_yen > 0),
    contact_preference text not null,
    message text,
    source_page text,
    created_at timestamptz not null default now()
);

alter table public.contact_inquiries enable row level security;
alter table public.volunteer_applications enable row level security;
alter table public.donation_applications enable row level security;

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant insert on table public.contact_inquiries to anon, authenticated;
grant insert on table public.volunteer_applications to anon, authenticated;
grant insert on table public.donation_applications to anon, authenticated;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'contact_inquiries' and policyname = 'anon_insert_contact_inquiries'
    ) then
        create policy anon_insert_contact_inquiries
            on public.contact_inquiries
            for insert
            to anon
            with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'volunteer_applications' and policyname = 'anon_insert_volunteer_applications'
    ) then
        create policy anon_insert_volunteer_applications
            on public.volunteer_applications
            for insert
            to anon
            with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'donation_applications' and policyname = 'anon_insert_donation_applications'
    ) then
        create policy anon_insert_donation_applications
            on public.donation_applications
            for insert
            to anon
            with check (true);
    end if;
end $$;

-- Optional settings for forms.js:
-- insert into public.settings (key, value) values ('form_notify_function_url', 'https://<project-ref>.functions.supabase.co/form-notify') on conflict (key) do update set value = excluded.value;
-- insert into public.settings (key, value) values ('form_notify_to', 'notify@example.com') on conflict (key) do update set value = excluded.value;
