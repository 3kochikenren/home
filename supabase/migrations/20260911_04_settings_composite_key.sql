-- =====================================================================
-- 2026-09-11 マルチテナント化 (4/4): settings テーブルを県連ごとに分離
--
-- 目的:
--   settings は key を主キーとする単一のキー・バリュー設定テーブルだったが、
--   県連ごとに異なる値（ヒーロー画像URL等）を持てるよう、
--   (kenren_id, key) の組で一意になるよう制約を作り直す。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 20260911_03_backfill_kenren_id.sql まで適用済みであること。
-- =====================================================================

do $$
declare
    pk_name text;
begin
    select tc.constraint_name into pk_name
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'settings'
      and tc.constraint_type = 'PRIMARY KEY';

    if pk_name is not null then
        execute format('alter table public.settings drop constraint %I;', pk_name);
    end if;
end $$;

alter table public.settings drop constraint if exists settings_kenren_key_unique;
alter table public.settings add constraint settings_kenren_key_unique unique (kenren_id, key);
