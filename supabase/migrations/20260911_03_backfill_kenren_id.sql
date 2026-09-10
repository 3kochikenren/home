-- =====================================================================
-- 2026-09-11 マルチテナント化 (3/4): 既存データを高知県連に割り当て
--
-- 目的:
--   これまでの全データは高知県連のものなので、kenren_id が NULL の行を
--   高知県連の id で埋め、以後は NOT NULL 制約をかける。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。kenren_id が既に入っている行は
--   上書きしない。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 20260911_02_add_kenren_id_columns.sql を先に適用しておくこと。
-- =====================================================================

do $$
declare
    t text;
    kochi_id uuid;
    all_tables text[] := array[
        'greeting', 'members', 'activities', 'news', 'settings',
        'announcements', 'tabloid_facilities', 'tabloid_issues', 'tabloid_placements',
        'contact_inquiries', 'volunteer_applications', 'donation_applications'
    ];
begin
    select id into kochi_id from public.kenren where slug = 'kochi';
    if kochi_id is null then
        raise exception 'kenren "kochi" が見つかりません。20260911_01_create_kenren_table.sql を先に適用してください。';
    end if;

    foreach t in array all_tables loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;
        execute format('update public.%I set kenren_id = $1 where kenren_id is null;', t) using kochi_id;
        execute format('alter table public.%I alter column kenren_id set not null;', t);
    end loop;
end $$;
