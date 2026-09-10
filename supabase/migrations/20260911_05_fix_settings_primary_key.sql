-- =====================================================================
-- 2026-09-11 是正: settings テーブルの主キー(id)復元
--
-- 背景:
--   20260911_04_settings_composite_key.sql は「key列が主キー」という誤った
--   前提で書かれており、実際には settings.id (uuid) が主キーだった。
--   そのため 04 実行時に id の PRIMARY KEY 制約が誤って削除されてしまった。
--   (kenren_id, key) の UNIQUE制約自体は意図通り追加されているので、
--   ここでは id の PRIMARY KEY だけを復元する。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。既に id に主キーが付いていれば
--   何もしない。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

do $$
declare
    has_pk boolean;
begin
    select exists (
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = 'settings'
          and constraint_type = 'PRIMARY KEY'
    ) into has_pk;

    if not has_pk then
        alter table public.settings add primary key (id);
    end if;
end $$;
