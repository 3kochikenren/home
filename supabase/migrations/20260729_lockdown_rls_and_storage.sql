-- =====================================================================
-- 2026-07-29  RLS / Storage 安全化（ロックダウン）
--
-- 目的:
--   - コンテンツ系テーブル : anon = SELECT のみ / authenticated = 全操作
--   - 公開フォーム系テーブル: anon = INSERT のみ（他人の投稿は読めない）/ authenticated = 全操作
--   - Storage 'images'      : 公開読み取りのみ / 書き込みは authenticated のみ
--
-- 背景:
--   既存の緩いポリシー（anon が UPDATE/DELETE 可能、Storage も anon が
--   INSERT/DELETE 可能）を、すべて削除してから正しいものを作り直す。
--   RLS ポリシーは「許可の OR」なので、緩いものが1つでも残っていると
--   それが優先される。よって既存ポリシーは総入れ替えする。
--
-- 安全性:
--   - 何度実行しても同じ結果になる（冪等）。
--   - service_role（Edge Function / 管理用）はRLSをバイパスするため影響なし。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 先に管理画面(admin.html)の更新版をデプロイしてから実行するのが安全。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) コンテンツ系テーブル（公開読み取り・管理者のみ書き込み）
-- ---------------------------------------------------------------------
do $$
declare
    t text;
    p record;
    content_tables text[] := array[
        'greeting','members','activities','news','settings',
        'announcements','tabloid_facilities','tabloid_issues','tabloid_placements'
    ];
begin
    foreach t in array content_tables loop
        -- 存在しないテーブルはスキップ
        if to_regclass('public.' || t) is null then
            continue;
        end if;

        execute format('alter table public.%I enable row level security;', t);

        -- 既存ポリシーを全削除（緩いものを残さない）
        for p in
            select policyname from pg_policies
            where schemaname = 'public' and tablename = t
        loop
            execute format('drop policy if exists %I on public.%I;', p.policyname, t);
        end loop;

        -- 権限の付け直し（多層防御：ポリシーだけでなく GRANT も絞る）
        execute format('revoke insert, update, delete on public.%I from anon;', t);
        execute format('grant select on public.%I to anon;', t);
        execute format('grant select, insert, update, delete on public.%I to authenticated;', t);

        -- 正しいポリシーを作成
        execute format(
            'create policy "anon_select_%1$s" on public.%1$I for select to anon using (true);', t);
        execute format(
            'create policy "auth_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true);', t);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) 公開フォーム系テーブル（誰でも投稿可・閲覧は管理者のみ）
-- ---------------------------------------------------------------------
do $$
declare
    t text;
    p record;
    form_tables text[] := array[
        'contact_inquiries','volunteer_applications','donation_applications'
    ];
begin
    foreach t in array form_tables loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;

        execute format('alter table public.%I enable row level security;', t);

        for p in
            select policyname from pg_policies
            where schemaname = 'public' and tablename = t
        loop
            execute format('drop policy if exists %I on public.%I;', p.policyname, t);
        end loop;

        -- anon は INSERT のみ（SELECT/UPDATE/DELETE は不可 = 他人の投稿を読めない）
        execute format('revoke select, update, delete on public.%I from anon;', t);
        execute format('grant insert on public.%I to anon;', t);
        execute format('grant select, insert, update, delete on public.%I to authenticated;', t);

        execute format(
            'create policy "anon_insert_%1$s" on public.%1$I for insert to anon with check (true);', t);
        execute format(
            'create policy "auth_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true);', t);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) Storage: images バケット（公開読み取り・書き込みは管理者のみ）
--    ※ このプロジェクトが使うバケットは 'images' のみである前提。
--       他のバケットがある場合は、下の削除条件を見直すこと。
-- ---------------------------------------------------------------------

-- 公開読み取りを維持（ウェブサイトが画像を表示するため）
update storage.buckets set public = true where id = 'images';

-- images に関わる既存ポリシー、および anon/public 宛の書き込みポリシーを削除
do $$
declare p record;
begin
    for p in
        select policyname
        from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and (
                coalesce(qual, '')       ilike '%images%'
             or coalesce(with_check, '') ilike '%images%'
             or policyname               ilike '%images%'
             or 'anon'   = any(roles)
             or 'public' = any(roles)
          )
    loop
        execute format('drop policy if exists %I on storage.objects;', p.policyname);
    end loop;
end $$;

-- 公開読み取り（バケットが public のため誰でも参照可）
create policy "images_public_read"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'images');

-- 書き込みは authenticated（＝ログイン済み管理者）のみ
create policy "images_auth_insert"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'images');

create policy "images_auth_update"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'images')
    with check (bucket_id = 'images');

create policy "images_auth_delete"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'images');

-- =====================================================================
-- 適用後の確認（任意・SELECTのみ）:
--   select tablename, policyname, roles, cmd
--   from pg_policies
--   where schemaname in ('public','storage')
--   order by tablename, policyname;
-- =====================================================================
