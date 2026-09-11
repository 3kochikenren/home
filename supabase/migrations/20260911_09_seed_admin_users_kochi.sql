-- =====================================================================
-- 2026-09-11 RBAC (2/3): 既存ログインアカウントを高知の kenren_admin として登録
--
-- 目的:
--   この後のRLS切り替え（20260911_10）で「admin_usersに登録が無いと
--   書き込み不可」になるため、現在ログインに使っている既存アカウントを
--   締め出さないよう、先に高知の kenren_admin として登録しておく。
--
--   既存の Supabase Auth ユーザー（auth.users）を全員、まだ admin_users に
--   登録されていなければ「高知の kenren_admin」として追加する。
--   現状ログイン用アカウントは通常1〜2件程度のはずなので安全に運用できる。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等。既に登録済みの行は変更しない）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   ※ 20260911_08_create_admin_users_rbac.sql を先に適用しておくこと。
--
-- 実行後の確認（推奨）:
--   select au.id, u.email, au.role, k.slug
--   from public.admin_users au
--   join auth.users u on u.id = au.id
--   left join public.kenren k on k.id = au.kenren_id
--   order by au.created_at;
--
--   ここで表示されるメールアドレスの一覧を確認し、意図した通りか
--   （見覚えのないアカウントが混ざっていないか）チェックしてください。
-- =====================================================================

insert into public.admin_users (id, kenren_id, role)
select u.id, k.id, 'kenren_admin'
from auth.users u
cross join (select id from public.kenren where slug = 'kochi') k
where not exists (
    select 1 from public.admin_users a where a.id = u.id
);
