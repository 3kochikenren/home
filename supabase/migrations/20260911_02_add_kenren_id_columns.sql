-- =====================================================================
-- 2026-09-11 マルチテナント化 (2/4): 各テーブルへ kenren_id 列を追加
--
-- 目的:
--   コンテンツ系・フォーム系の全テーブルに、どの県連のデータかを示す
--   kenren_id 列を追加する。この時点ではまだ NULL 許可・アプリ側でも未使用の
--   ため、既存サイト（高知）の動作には影響しない。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 20260911_01_create_kenren_table.sql を先に適用しておくこと。
-- =====================================================================

do $$
declare
    t text;
    all_tables text[] := array[
        'greeting', 'members', 'activities', 'news', 'settings',
        'announcements', 'tabloid_facilities', 'tabloid_issues', 'tabloid_placements',
        'contact_inquiries', 'volunteer_applications', 'donation_applications'
    ];
begin
    foreach t in array all_tables loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;
        execute format(
            'alter table public.%I add column if not exists kenren_id uuid references public.kenren(id);', t);
        execute format(
            'create index if not exists idx_%1$s_kenren_id on public.%1$I (kenren_id);', t);
    end loop;
end $$;
