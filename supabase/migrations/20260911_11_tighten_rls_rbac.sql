-- =====================================================================
-- 2026-09-11 RBAC (4/4): RLSを「ログインすれば全権限」から役割ベースに切替
--
-- 目的:
--   これまでの「authenticated（ログイン済みなら誰でも）は全操作可」という
--   ポリシーを廃止し、admin_users のロール・kenren_id に基づいた
--   権限判定（can_write_kenren）に置き換える。
--
--   - 閲覧（SELECT）: ログイン済みなら誰でも可（viewer含む）。
--     ※ 公開サイト向けの anon SELECT ポリシーは変更しない。
--   - 書き込み（INSERT/UPDATE/DELETE）: can_write_kenren(kenren_id) が
--     true の場合のみ（super_admin は常にtrue、kenren_adminは自分の
--     県連のデータのみ、viewerは常にfalse）。
--
-- 前提:
--   20260911_08〜10 を適用済みで、既存ログインアカウントが admin_users に
--   正しく登録されていること（確認済み）。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) コンテンツ系テーブル（kenren_id を持つテーブル全般）
-- ---------------------------------------------------------------------
do $$
declare
    t text;
    content_tables text[] := array[
        'greeting', 'members', 'activities', 'news', 'settings',
        'announcements', 'tabloid_facilities', 'tabloid_issues', 'tabloid_placements',
        'org_officer_groups'
    ];
begin
    foreach t in array content_tables loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;

        -- 旧ポリシー（authenticated = 全操作可）を削除
        execute format('drop policy if exists %I on public.%I;', 'auth_all_' || t, t);

        -- 新ポリシー: 閲覧はログイン済みなら誰でも
        execute format(
            'create policy %I on public.%I for select to authenticated using (true);',
            'auth_select_' || t, t);

        -- 新ポリシー: 書き込みは can_write_kenren(kenren_id) が true の場合のみ
        execute format(
            'create policy %I on public.%I for insert to authenticated with check (public.can_write_kenren(kenren_id));',
            'auth_insert_' || t, t);
        execute format(
            'create policy %I on public.%I for update to authenticated using (public.can_write_kenren(kenren_id)) with check (public.can_write_kenren(kenren_id));',
            'auth_update_' || t, t);
        execute format(
            'create policy %I on public.%I for delete to authenticated using (public.can_write_kenren(kenren_id));',
            'auth_delete_' || t, t);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) 公開フォーム系テーブル（お問い合わせ等）
--    anon の INSERT のみポリシーはそのまま維持。authenticated 側を
--    can_write_kenren ベースに変更（他県連の問い合わせが見えないように）。
-- ---------------------------------------------------------------------
do $$
declare
    t text;
    form_tables text[] := array[
        'contact_inquiries', 'volunteer_applications', 'donation_applications'
    ];
begin
    foreach t in array form_tables loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;

        execute format('drop policy if exists %I on public.%I;', 'auth_all_' || t, t);

        execute format(
            'create policy %I on public.%I for select to authenticated using (public.can_write_kenren(kenren_id));',
            'auth_select_' || t, t);
        execute format(
            'create policy %I on public.%I for update to authenticated using (public.can_write_kenren(kenren_id)) with check (public.can_write_kenren(kenren_id));',
            'auth_update_' || t, t);
        execute format(
            'create policy %I on public.%I for delete to authenticated using (public.can_write_kenren(kenren_id));',
            'auth_delete_' || t, t);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) kenren テーブル（県連そのものの追加・編集）: super_admin のみ
-- ---------------------------------------------------------------------
drop policy if exists "auth_all_kenren" on public.kenren;

drop policy if exists "super_admin_insert_kenren" on public.kenren;
create policy "super_admin_insert_kenren"
    on public.kenren for insert
    to authenticated
    with check (public.is_super_admin());

drop policy if exists "super_admin_update_kenren" on public.kenren;
create policy "super_admin_update_kenren"
    on public.kenren for update
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop policy if exists "super_admin_delete_kenren" on public.kenren;
create policy "super_admin_delete_kenren"
    on public.kenren for delete
    to authenticated
    using (public.is_super_admin());

-- =====================================================================
-- 適用後の確認（推奨・SELECTのみ）:
--   select tablename, policyname, roles, cmd
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, policyname;
-- =====================================================================
