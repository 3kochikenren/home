-- =====================================================================
-- 2026-09-11 ホームページのタイル化 (1/2): tile_types / kenren_home_tiles
--
-- 目的:
--   トップページの構成要素（イベント・役員・活動報告など）を、
--   県連ごとに「選択・並び替え・表示/非表示」できるようにする。
--
--   tile_types      … タイルの種類マスター（プラットフォーム共通のカタログ。
--                      新しい種類は後から行を追加するだけで拡張できる）
--   kenren_home_tiles … 県連ごとの実際の配置（どの種類を・どの順番で・
--                      表示するか、種類ごとの追加設定）
--
--   is_active=false のタイル種類は「まだ実装されていない・現時点では
--   選べない」種類（募集/イベント紹介/選挙タイルは別フェーズで実装予定）。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。この時点ではindex.html/script.js
--   はまだ新テーブルを参照していないため、既存サイトへの影響なし。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

create table if not exists public.tile_types (
    id text primary key,
    label text not null,
    description text,
    icon text,
    sort_order int not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.tile_types enable row level security;

drop policy if exists "anon_select_tile_types" on public.tile_types;
create policy "anon_select_tile_types"
    on public.tile_types for select
    to anon, authenticated
    using (true);

drop policy if exists "super_admin_write_tile_types" on public.tile_types;
create policy "super_admin_write_tile_types"
    on public.tile_types for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

grant select on public.tile_types to anon;
grant select, insert, update, delete on public.tile_types to authenticated;

insert into public.tile_types (id, label, description, icon, sort_order, is_active) values
    ('events', 'イベント', '開催予定のイベント・お知らせの一覧', 'fa-calendar-days', 1, true),
    ('announcements', 'お知らせ', '期間限定で目立たせたいお知らせカード', 'fa-bullhorn', 2, true),
    ('officers_kenren', '県連役員', '県連4役・県連役員の紹介', 'fa-building-columns', 3, true),
    ('officers_branch', '支部役員', '各支部の役員紹介', 'fa-people-group', 4, true),
    ('members', '議員紹介', '所属議員・公認候補者・改革委員の紹介', 'fa-users', 5, true),
    ('activities', '活動報告', '活動報告の一覧', 'fa-newspaper', 6, true),
    ('recruiting', '募集', '党員・サポーター等の募集案内カード（近日対応）', 'fa-hand-holding-heart', 7, false),
    ('event_highlight', 'イベント紹介', '特定のイベントを大きく紹介するカード（近日対応）', 'fa-star', 8, false),
    ('election_support', '選挙', '選挙中の候補者への応援を呼びかけるカード（近日対応）', 'fa-flag', 9, false)
on conflict (id) do update set
    label = excluded.label,
    description = excluded.description,
    icon = excluded.icon,
    sort_order = excluded.sort_order;

create table if not exists public.kenren_home_tiles (
    id uuid primary key default gen_random_uuid(),
    kenren_id uuid not null references public.kenren(id),
    tile_type text not null references public.tile_types(id),
    sort_order int not null default 0,
    is_visible boolean not null default true,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_kenren_home_tiles_kenren_id on public.kenren_home_tiles (kenren_id);

alter table public.kenren_home_tiles enable row level security;

drop policy if exists "anon_select_kenren_home_tiles" on public.kenren_home_tiles;
create policy "anon_select_kenren_home_tiles"
    on public.kenren_home_tiles for select
    to anon
    using (true);

drop policy if exists "auth_select_kenren_home_tiles" on public.kenren_home_tiles;
create policy "auth_select_kenren_home_tiles"
    on public.kenren_home_tiles for select
    to authenticated
    using (public.can_view_kenren(kenren_id));

drop policy if exists "auth_insert_kenren_home_tiles" on public.kenren_home_tiles;
create policy "auth_insert_kenren_home_tiles"
    on public.kenren_home_tiles for insert
    to authenticated
    with check (public.can_write_kenren(kenren_id));

drop policy if exists "auth_update_kenren_home_tiles" on public.kenren_home_tiles;
create policy "auth_update_kenren_home_tiles"
    on public.kenren_home_tiles for update
    to authenticated
    using (public.can_write_kenren(kenren_id))
    with check (public.can_write_kenren(kenren_id));

drop policy if exists "auth_delete_kenren_home_tiles" on public.kenren_home_tiles;
create policy "auth_delete_kenren_home_tiles"
    on public.kenren_home_tiles for delete
    to authenticated
    using (public.can_write_kenren(kenren_id));

grant select on public.kenren_home_tiles to anon;
grant select, insert, update, delete on public.kenren_home_tiles to authenticated;

-- 高知の現在のホーム画面構成（今までの固定順）をそのまま初期配置として登録する
insert into public.kenren_home_tiles (kenren_id, tile_type, sort_order, is_visible)
select k.id, v.tile_type, v.sort_order, true
from public.kenren k
cross join (values
    ('events', 1),
    ('announcements', 2),
    ('officers_kenren', 3),
    ('officers_branch', 4),
    ('members', 5),
    ('activities', 6)
) as v(tile_type, sort_order)
where k.slug = 'kochi'
  and not exists (
      select 1 from public.kenren_home_tiles h
      where h.kenren_id = k.id and h.tile_type = v.tile_type
  );
