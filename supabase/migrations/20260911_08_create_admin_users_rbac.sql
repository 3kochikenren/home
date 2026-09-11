-- =====================================================================
-- 2026-09-11 RBAC (1/3): admin_users テーブルと権限判定関数の作成
--
-- 目的:
--   3階層の管理者権限を実現するための土台。
--     super_admin  … 全県連を閲覧・編集可能（kenren_id は NULL）
--     kenren_admin … 自分の kenren_id のデータのみ編集可能
--     viewer       … 閲覧のみ（書き込み不可）
--
--   この時点ではまだ既存テーブルのRLSは変更しない（安全のため、
--   admin_users の準備が整ってから 20260911_10 で切り替える）。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。既存サイトへの影響なし。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

create table if not exists public.admin_users (
    id uuid primary key references auth.users(id) on delete cascade,
    kenren_id uuid references public.kenren(id),
    role text not null check (role in ('super_admin', 'kenren_admin', 'viewer')),
    created_at timestamptz not null default now(),
    constraint admin_users_role_kenren_check check (
        (role = 'super_admin' and kenren_id is null)
        or (role in ('kenren_admin', 'viewer') and kenren_id is not null)
    )
);

alter table public.admin_users enable row level security;

-- ---------------------------------------------------------------------
-- 権限判定関数（SECURITY DEFINER: admin_users自身のRLSと循環参照しないため）
-- ※ ポリシーより先に作成する（ポリシー作成時に関数の実在確認が行われるため）
-- ---------------------------------------------------------------------

create or replace function public.current_admin_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
    select role from public.admin_users where id = auth.uid();
$$;

create or replace function public.current_admin_kenren_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
    select kenren_id from public.admin_users where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.admin_users where id = auth.uid() and role = 'super_admin'
    );
$$;

-- 指定した kenren_id のデータを、今ログインしている管理者が
-- 書き込み（insert/update/delete）してよいかどうか。
create or replace function public.can_write_kenren(target_kenren_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.admin_users
        where id = auth.uid()
          and (
              role = 'super_admin'
              or (role = 'kenren_admin' and kenren_id = target_kenren_id)
          )
    );
$$;

grant execute on function public.current_admin_role() to authenticated, anon;
grant execute on function public.current_admin_kenren_id() to authenticated, anon;
grant execute on function public.is_super_admin() to authenticated, anon;
grant execute on function public.can_write_kenren(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------
-- ポリシー（関数を作成し終えた後で定義する）
-- ---------------------------------------------------------------------

-- 自分自身の行は誰でも読める（ログイン直後に自分のロールを取得するため）。
-- super_admin は全員分を読める。
drop policy if exists "self_or_super_select_admin_users" on public.admin_users;
create policy "self_or_super_select_admin_users"
    on public.admin_users for select
    to authenticated
    using (id = auth.uid() or public.is_super_admin());

-- 書き込み（招待・ロール変更・削除）は super_admin のみ。
drop policy if exists "super_admin_insert_admin_users" on public.admin_users;
create policy "super_admin_insert_admin_users"
    on public.admin_users for insert
    to authenticated
    with check (public.is_super_admin());

drop policy if exists "super_admin_update_admin_users" on public.admin_users;
create policy "super_admin_update_admin_users"
    on public.admin_users for update
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop policy if exists "super_admin_delete_admin_users" on public.admin_users;
create policy "super_admin_delete_admin_users"
    on public.admin_users for delete
    to authenticated
    using (public.is_super_admin());

grant select, insert, update, delete on public.admin_users to authenticated;
