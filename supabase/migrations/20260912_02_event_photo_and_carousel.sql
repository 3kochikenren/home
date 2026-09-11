-- =====================================================================
-- 2026-09-12 イベントへの写真追加とイベントカルーセルタイル
--
-- 目的:
--   news（イベント）に写真1枚と「カルーセルに表示」フラグを追加し、
--   トップページに配置できる「イベントカルーセル」タイルを新設する。
--
--   photo_url          … イベントの写真（1枚）。既存の「イベント」一覧
--                          タイルには表示しない。イベントカレンダーの
--                          詳細ポップアップには小さく表示する。
--   show_in_carousel   … イベントカルーセルタイルに表示するか。
--                          既定は false（写真が無い既存データが空スライド
--                          にならないよう、オプトインにする）。
--                          表示対象は published_date が今日以降のものだけ
--                          （開催日を過ぎると自動的に表示されなくなる）。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。既存の「イベント」タイルの
--   見た目は変化しない。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

alter table public.news add column if not exists photo_url text;
alter table public.news add column if not exists show_in_carousel boolean not null default false;

insert into public.tile_types (id, label, description, icon, sort_order, is_active) values
    ('event_carousel', 'イベントカルーセル', '写真付きイベントをスライドショーで紹介するタイル（開催日を過ぎると自動的に表示終了）', 'fa-images', 11, true)
on conflict (id) do update set
    label = excluded.label,
    description = excluded.description,
    icon = excluded.icon,
    is_active = excluded.is_active;
