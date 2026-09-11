-- =====================================================================
-- 2026-09-11 RBAC (3/4): super_admin アカウントの割り当て
--
-- 目的:
--   Supabase ダッシュボード（Authentication → Users）で新規作成した
--   super_admin用アカウントに、admin_users上でsuper_adminロールを付与する。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。対象メールのユーザーが
--   auth.users に存在しない場合は何も登録されない（0件）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 事前に Authentication → Users で該当メールのアカウントを
--     作成しておくこと。
--
-- 実行後の確認（推奨）:
--   select au.id, u.email, au.role, au.kenren_id
--   from public.admin_users au
--   join auth.users u on u.id = au.id
--   where u.email = 'yamamoto.yasuhiro.japan@gmail.com';
-- =====================================================================

insert into public.admin_users (id, kenren_id, role)
select u.id, null, 'super_admin'
from auth.users u
where u.email = 'yamamoto.yasuhiro.japan@gmail.com'
on conflict (id) do update set role = 'super_admin', kenren_id = null;
