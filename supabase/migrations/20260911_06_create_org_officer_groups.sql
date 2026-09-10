-- =====================================================================
-- 2026-09-11 組織構造マスター化 (1/2): org_officer_groups テーブル作成
--
-- 目的:
--   役員紹介（greeting）の表示単位（県連4役・県連役員・各支部など）を
--   コード決め打ちではなく、県連ごとにDBで自由設定できるようにする。
--
--   group_type:
--     'fixed'  … 固定役職枠（例: 県連4役）。fixed_slots に役職名を順番に格納
--     'multi'  … 自由人数（例: 県連役員）。役職名は各メンバーが個別に入力
--     'branch' … 支部。head_role_label で「代表者の役職名」を指定（既定:支部長）
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。既存サイトへの影響なし
--   （この時点ではまだ greeting テーブル側を紐付けていない）。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

create table if not exists public.org_officer_groups (
    id uuid primary key default gen_random_uuid(),
    kenren_id uuid not null references public.kenren(id),
    group_type text not null check (group_type in ('fixed', 'multi', 'branch')),
    label text not null,
    fixed_slots text[],
    head_role_label text,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

alter table public.org_officer_groups enable row level security;

drop policy if exists "anon_select_org_officer_groups" on public.org_officer_groups;
create policy "anon_select_org_officer_groups"
    on public.org_officer_groups for select
    to anon, authenticated
    using (true);

drop policy if exists "auth_all_org_officer_groups" on public.org_officer_groups;
create policy "auth_all_org_officer_groups"
    on public.org_officer_groups for all
    to authenticated
    using (true) with check (true);

grant select on public.org_officer_groups to anon;
grant select, insert, update, delete on public.org_officer_groups to authenticated;

-- 既存の高知県連の組織構造（コード決め打ちだったもの）をマスターへ登録（冪等）
insert into public.org_officer_groups (kenren_id, group_type, label, fixed_slots, sort_order)
select k.id, 'fixed', '県連4役', array['県連会長', '県連副会長', '事務局長', '財政局長'], 1
from public.kenren k
where k.slug = 'kochi'
  and not exists (
      select 1 from public.org_officer_groups g where g.kenren_id = k.id and g.label = '県連4役'
  );

insert into public.org_officer_groups (kenren_id, group_type, label, sort_order)
select k.id, 'multi', '県連役員', 2
from public.kenren k
where k.slug = 'kochi'
  and not exists (
      select 1 from public.org_officer_groups g where g.kenren_id = k.id and g.label = '県連役員'
  );

insert into public.org_officer_groups (kenren_id, group_type, label, head_role_label, sort_order)
select k.id, 'branch', '第一支部役員', '支部長', 3
from public.kenren k
where k.slug = 'kochi'
  and not exists (
      select 1 from public.org_officer_groups g where g.kenren_id = k.id and g.label = '第一支部役員'
  );

insert into public.org_officer_groups (kenren_id, group_type, label, head_role_label, sort_order)
select k.id, 'branch', '第二支部役員', '支部長', 4
from public.kenren k
where k.slug = 'kochi'
  and not exists (
      select 1 from public.org_officer_groups g where g.kenren_id = k.id and g.label = '第二支部役員'
  );
