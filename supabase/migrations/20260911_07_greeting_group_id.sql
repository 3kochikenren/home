-- =====================================================================
-- 2026-09-11 組織構造マスター化 (2/2): greeting を org_officer_groups に紐付け
--
-- 目的:
--   greeting.position_label（文字列一致）に頼っていた紐付けを、
--   org_officer_groups.id への外部キー参照に置き換える。
--   これにより支部名の変更や追加がデータ側だけで完結するようになる。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。position_label 列は削除せず
--   残す（ロールバック時の安全網。今後のアプリコードは group_id のみ使用）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 20260911_06_create_org_officer_groups.sql を先に適用しておくこと。
-- =====================================================================

alter table public.greeting add column if not exists group_id uuid references public.org_officer_groups(id);
create index if not exists idx_greeting_group_id on public.greeting (group_id);

update public.greeting g
set group_id = og.id
from public.org_officer_groups og
where g.group_id is null
  and og.kenren_id = g.kenren_id
  and og.label = coalesce(g.position_label, '県連役員');
