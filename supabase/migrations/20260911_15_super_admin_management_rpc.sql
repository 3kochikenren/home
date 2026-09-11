-- =====================================================================
-- 2026-09-11 super_admin向け自己完結型の管理機能 (1/2): RPC関数
--
-- 目的:
--   これまで私(Claude)がSQLを直接書いて対応していた
--     ・新しい県連の追加（org_officer_groups/kenren_home_tilesの初期設定込み）
--     ・管理者アカウントへのロール割り当て（admin_users登録）
--   を、admin.html上のUIからsuper_adminが自分で行えるようにする。
--
--   auth.users を直接クエリする必要があるため SECURITY DEFINER 関数として
--   実装し、内部で is_super_admin() チェックを行う（呼び出し元がsuper_admin
--   でなければ例外を投げる）。
--
--   アカウント自体の作成（メールアドレス・パスワード設定）は、これまで
--   通りSupabaseダッシュボード（Authentication → Users → Add user）で
--   手動で行う。ここではその後の「権限付与」だけを自動化する。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等・CREATE OR REPLACE）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

-- 新しい県連を、既定の組織構造・ホーム画面構成つきで作成する
create or replace function public.create_kenren_with_defaults(
    p_slug text,
    p_prefecture_name text,
    p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    new_kenren_id uuid;
begin
    if not public.is_super_admin() then
        raise exception '権限がありません（super_adminのみ実行できます）';
    end if;

    insert into public.kenren (slug, prefecture_name, display_name)
    values (p_slug, p_prefecture_name, p_display_name)
    returning id into new_kenren_id;

    insert into public.org_officer_groups (kenren_id, group_type, label, fixed_slots, sort_order) values
        (new_kenren_id, 'fixed', '県連4役', array['県連会長', '県連副会長', '事務局長', '財政局長'], 1);
    insert into public.org_officer_groups (kenren_id, group_type, label, sort_order) values
        (new_kenren_id, 'multi', '県連役員', 2);

    insert into public.kenren_home_tiles (kenren_id, tile_type, sort_order, is_visible)
    select new_kenren_id, v.tile_type, v.sort_order, true
    from (values
        ('events', 1),
        ('announcements', 2),
        ('officers_kenren', 3),
        ('officers_branch', 4),
        ('members', 5),
        ('activities', 6)
    ) as v(tile_type, sort_order);

    return new_kenren_id;
end;
$$;

grant execute on function public.create_kenren_with_defaults(text, text, text) to authenticated;

-- メールアドレスを指定して、既存のSupabase Authアカウントに
-- admin_usersのロール・所属県連を割り当てる（アカウント自体は
-- 事前にダッシュボードで作成しておく必要がある）
create or replace function public.admin_assign_role(
    target_email text,
    target_role text,
    target_kenren_slug text default null
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

    insert into public.admin_users (id, kenren_id, role)
    values (target_user_id, target_kenren_id, target_role)
    on conflict (id) do update set role = excluded.role, kenren_id = excluded.kenren_id;
end;
$$;

grant execute on function public.admin_assign_role(text, text, text) to authenticated;

-- 現在登録済みの管理者一覧を、メールアドレス付きで取得する
-- （auth.usersはPostgREST経由で直接読めないためSECURITY DEFINERで橋渡しする）
create or replace function public.admin_list_users()
returns table(id uuid, email text, role text, kenren_id uuid, kenren_label text, created_at timestamptz)
language sql
security definer
stable
set search_path = public, auth
as $$
    select au.id, u.email, au.role, au.kenren_id, k.display_name, au.created_at
    from public.admin_users au
    join auth.users u on u.id = au.id
    left join public.kenren k on k.id = au.kenren_id
    where public.is_super_admin()
    order by au.created_at;
$$;

grant execute on function public.admin_list_users() to authenticated;
