-- =====================================================================
-- 2026-09-11 RBAC是正: 閲覧(SELECT)も自分の県連のみに絞る
--
-- 背景:
--   20260911_11 で書き込みは can_write_kenren() で県連ごとに絞ったが、
--   閲覧(SELECT)は「ログイン済みなら誰でも全県連分読める」ままだった。
--   admin.html の画面上は自分の県連しか出さない作りだが、Supabase の
--   REST APIを直接叩けば、ログイン済みの他県連kenren_adminが別の県連の
--   データを読めてしまう状態＝「他県連adminが見えないように」という
--   要望に対して不十分。今のうちに是正する（現状は県連が高知のみの
--   ため、見た目上の影響は無い）。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 20260911_08〜11 を適用済みであること。
-- =====================================================================

create or replace function public.can_view_kenren(target_kenren_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.admin_users
        where id = auth.uid()
          and (role = 'super_admin' or kenren_id = target_kenren_id)
    );
$$;

grant execute on function public.can_view_kenren(uuid) to authenticated, anon;

do $$
declare
    t text;
    all_tables text[] := array[
        'greeting', 'members', 'activities', 'news', 'settings',
        'announcements', 'tabloid_facilities', 'tabloid_issues', 'tabloid_placements',
        'org_officer_groups',
        'contact_inquiries', 'volunteer_applications', 'donation_applications'
    ];
begin
    foreach t in array all_tables loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;
        execute format('drop policy if exists %I on public.%I;', 'auth_select_' || t, t);
        execute format(
            'create policy %I on public.%I for select to authenticated using (public.can_view_kenren(kenren_id));',
            'auth_select_' || t, t);
    end loop;
end $$;
