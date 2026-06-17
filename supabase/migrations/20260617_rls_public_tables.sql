-- RLS for public content tables
-- anon: SELECT only
-- authenticated: full access (admin operations)

alter table public.greeting enable row level security;
alter table public.members enable row level security;
alter table public.activities enable row level security;
alter table public.news enable row level security;
alter table public.settings enable row level security;

-- greeting
create policy "anon can read greeting"
    on public.greeting for select to anon using (true);

create policy "authenticated full access greeting"
    on public.greeting for all to authenticated using (true) with check (true);

-- members
create policy "anon can read members"
    on public.members for select to anon using (true);

create policy "authenticated full access members"
    on public.members for all to authenticated using (true) with check (true);

-- activities
create policy "anon can read activities"
    on public.activities for select to anon using (true);

create policy "authenticated full access activities"
    on public.activities for all to authenticated using (true) with check (true);

-- news
create policy "anon can read news"
    on public.news for select to anon using (true);

create policy "authenticated full access news"
    on public.news for all to authenticated using (true) with check (true);

-- settings
create policy "anon can read settings"
    on public.settings for select to anon using (true);

create policy "authenticated full access settings"
    on public.settings for all to authenticated using (true) with check (true);
