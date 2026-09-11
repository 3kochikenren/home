-- =====================================================================
-- 2026-09-11 県連管理者による自県連スタッフ管理
--
-- 目的:
--   これまで管理者アカウントの登録・権限付与は super_admin 限定だった。
--   各県連の kenren_admin が、自分の県連に所属するスタッフ（kenren_admin /
--   viewer）を自分たちで管理できるようにする（他県連への付与や、
--   super_adminの付与はできない）。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。
--   kenren_admin_assign_role は、既に別の県連に登録済みのアカウントを
--   誤って奪わないよう、その場合はエラーにする。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

-- 自分の県連に所属する管理者一覧（メールアドレス付き）を取得する
create or replace function public.kenren_admin_list_users()
returns table(id uuid, email text, role text, created_at timestamptz)
language sql
security definer
stable
set search_path = public, auth
as $$
    select au.id, u.email, au.role, au.created_at
    from public.admin_users au
    join auth.users u on u.id = au.id
    where public.current_admin_role() = 'kenren_admin'
      and au.kenren_id = public.current_admin_kenren_id()
    order by au.created_at;
$$;

grant execute on function public.kenren_admin_list_users() to authenticated;

-- 自分の県連に、既存アカウントを kenren_admin / viewer として登録する
create or replace function public.kenren_admin_assign_role(
    target_email text,
    target_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    caller_kenren_id uuid;
    target_user_id uuid;
begin
    if public.current_admin_role() != 'kenren_admin' then
        raise exception '権限がありません（県連管理者のみ実行できます）';
    end if;

    if target_role not in ('kenren_admin', 'viewer') then
        raise exception '付与できるロールは「県連管理者」「閲覧専用」のみです';
    end if;

    caller_kenren_id := public.current_admin_kenren_id();
    if caller_kenren_id is null then
        raise exception '所属県連が取得できません';
    end if;

    select id into target_user_id from auth.users where email = target_email;
    if target_user_id is null then
        raise exception 'このメールアドレスのアカウントが見つかりません。先にSupabaseダッシュボード（Authentication → Users）でアカウントを作成してください。';
    end if;

    if exists (
        select 1 from public.admin_users
        where id = target_user_id and kenren_id is distinct from caller_kenren_id
    ) then
        raise exception 'このアカウントは既に別の県連の管理者として登録されています。';
    end if;

    insert into public.admin_users (id, kenren_id, role)
    values (target_user_id, caller_kenren_id, target_role)
    on conflict (id) do update set role = excluded.role, kenren_id = excluded.kenren_id;
end;
$$;

grant execute on function public.kenren_admin_assign_role(text, text) to authenticated;

-- 自分の県連のスタッフ（自分自身を除く）を削除できるようにする
drop policy if exists "kenren_admin_delete_admin_users" on public.admin_users;
create policy "kenren_admin_delete_admin_users"
    on public.admin_users for delete
    to authenticated
    using (
        public.current_admin_role() = 'kenren_admin'
        and kenren_id = public.current_admin_kenren_id()
        and id <> auth.uid()
    );
