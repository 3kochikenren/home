-- =====================================================================
-- 2026-09-11 super_admin バックアップアカウントの割り当て
--
-- 目的:
--   既存のsuper_adminアカウント(yamamoto.yasuhiro.japan@gmail.com)が
--   パスワード再設定メールの送信制限で一時的にログインできない状態に
--   なったため、新しく作成したアカウントにもsuper_adminを付与する。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。既存のsuper_adminアカウントは
--   そのまま残る（今回の付与とは無関係に、後で復旧可能ならそのまま
--   使い続けて問題ない）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--
-- 実行後の確認（推奨）:
--   select au.id, u.email, au.role, au.kenren_id
--   from public.admin_users au
--   join auth.users u on u.id = au.id
--   where u.email = 'yamamoto.yasuhiro.39@gmail.com';
-- =====================================================================

insert into public.admin_users (id, kenren_id, role)
select u.id, null, 'super_admin'
from auth.users u
where u.email = 'yamamoto.yasuhiro.39@gmail.com'
on conflict (id) do update set role = 'super_admin', kenren_id = null;
