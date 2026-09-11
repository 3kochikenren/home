-- =====================================================================
-- 2026-09-11 管理者アカウントに名前を追加
--
-- 目的:
--   admin_users がメールアドレスのみだったため、name列を追加し、
--   一覧表示や権限付与時に氏名を入力・表示できるようにする。
--   あわせて super_admin向け admin_list_users() / kenren_admin向け
--   kenren_admin_list_users() が name も返すよう作り直す。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。既存データのnameはNULL
--   （未入力）のままになるが、動作に支障はない。
--   関数の返り値の列構成を変えるため、CREATE OR REPLACEではなく
--   一度DROPしてから作り直す（PostgRESTでの関数曖昧エラーを避けるため）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

alter table public.admin_users add column if not exists name text;

drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table(id uuid, email text, name text, role text, kenren_id uuid, kenren_label text, created_at timestamptz)
language sql
security definer
stable
set search_path = public, auth
as $$
    select au.id, u.email, au.name, au.role, au.kenren_id, k.display_name, au.created_at
    from public.admin_users au
    join auth.users u on u.id = au.id
    left join public.kenren k on k.id = au.kenren_id
    where public.is_super_admin()
    order by au.created_at;
$$;
grant execute on function public.admin_list_users() to authenticated;

drop function if exists public.kenren_admin_list_users();
create function public.kenren_admin_list_users()
returns table(id uuid, email text, name text, role text, created_at timestamptz)
language sql
security definer
stable
set search_path = public, auth
as $$
    select au.id, u.email, au.name, au.role, au.created_at
    from public.admin_users au
    join auth.users u on u.id = au.id
    where public.current_admin_role() = 'kenren_admin'
      and au.kenren_id = public.current_admin_kenren_id()
    order by au.created_at;
$$;
grant execute on function public.kenren_admin_list_users() to authenticated;

drop function if exists public.admin_assign_role(text, text, text);
create function public.admin_assign_role(
    target_email text,
    target_role text,
    target_kenren_slug text default null,
    target_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    target_user_id uuid;
    target_kenren_id uuid;
begin
    if not public.is_super_admin() then
        raise exception '権限がありません（super_adminのみ実行できます）';
    end if;

    if target_role not in ('super_admin', 'kenren_admin', 'viewer') then
        raise exception '不正なロールです: %', target_role;
    end if;

    select id into target_user_id from auth.users where email = target_email;
    if target_user_id is null then
        raise exception 'このメールアドレスのアカウントが見つかりません。先にSupabaseダッシュボード（Authentication → Users）でアカウントを作成してください。';
    end if;

    if target_role = 'super_admin' then
        target_kenren_id := null;
    else
        if target_kenren_slug is null or target_kenren_slug = '' then
            raise exception 'kenren_adminまたはviewerには県連の指定が必要です';
        end if;
        select id into target_kenren_id from public.kenren where slug = target_kenren_slug;
        if target_kenren_id is null then
            raise exception '指定された県連が見つかりません: %', target_kenren_slug;
        end if;
    end if;

    insert into public.admin_users (id, kenren_id, role, name)
    values (target_user_id, target_kenren_id, target_role, nullif(target_name, ''))
    on conflict (id) do update set
        role = excluded.role,
        kenren_id = excluded.kenren_id,
        name = coalesce(excluded.name, public.admin_users.name);
end;
$$;
grant execute on function public.admin_assign_role(text, text, text, text) to authenticated;

drop function if exists public.kenren_admin_assign_role(text, text);
create function public.kenren_admin_assign_role(
    target_email text,
    target_role text,
    target_name text default null
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

    insert into public.admin_users (id, kenren_id, role, name)
    values (target_user_id, caller_kenren_id, target_role, nullif(target_name, ''))
    on conflict (id) do update set
        role = excluded.role,
        kenren_id = excluded.kenren_id,
        name = coalesce(excluded.name, public.admin_users.name);
end;
$$;
grant execute on function public.kenren_admin_assign_role(text, text, text) to authenticated;
