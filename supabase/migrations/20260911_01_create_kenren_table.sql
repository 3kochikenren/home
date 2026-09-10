-- =====================================================================
-- 2026-09-11 マルチテナント化 (1/4): kenren（県連）マスターテーブル作成
--
-- 目的:
--   複数の都道府県連が1つのシステムを共有できるようにするための
--   テナント管理テーブル。既存の高知県連データを最初のテナントとして登録する。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。既存サイトへの影響なし。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

create table if not exists public.kenren (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,           -- URL・内部参照用の識別子（例: 'kochi'）
    prefecture_name text not null,       -- 都道府県名（例: '高知県'）
    display_name text not null,          -- サイト表示名（例: '参政党高知県支部連合会'）
    status text not null default 'active' check (status in ('active', 'inactive')),
    created_at timestamptz not null default now()
);

alter table public.kenren enable row level security;

-- どの県連が存在するかは非公開情報ではないため anon にも読み取りを許可
drop policy if exists "anon_select_kenren" on public.kenren;
create policy "anon_select_kenren"
    on public.kenren for select
    to anon, authenticated
    using (true);

-- 書き込みは authenticated のみ（次フェーズで super_admin 限定に絞り込む）
drop policy if exists "auth_all_kenren" on public.kenren;
create policy "auth_all_kenren"
    on public.kenren for all
    to authenticated
    using (true) with check (true);

grant select on public.kenren to anon;
grant select, insert, update, delete on public.kenren to authenticated;

-- 既存の高知県連データを最初のテナントとして登録（冪等）
insert into public.kenren (slug, prefecture_name, display_name)
values ('kochi', '高知県', '参政党高知県支部連合会')
on conflict (slug) do nothing;
