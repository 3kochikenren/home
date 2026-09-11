-- =====================================================================
-- 2026-09-12 イベントカレンダータイルの追加
--
-- 目的:
--   news（イベント）に「イベントタイルへの表示」「イベントカレンダー
--   タイルへの表示」を個別に持たせ、Googleカレンダー風の月表示タイル
--   （event_calendar）を追加する。
--
--   show_in_events   … 既存の「イベント」一覧タイルに出すか
--   show_in_calendar … 新しい「イベントカレンダー」タイルに出すか
--   どちらも既定は true（既存データ・既存の見た目を変えないため）。
--
-- 安全性:
--   何度実行しても同じ結果になる（冪等）。列追加は既定trueなので、
--   既存の「イベント」タイルの表示内容は変化しない。
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor に貼り付けて実行。
-- =====================================================================

alter table public.news add column if not exists show_in_events boolean not null default true;
alter table public.news add column if not exists show_in_calendar boolean not null default true;

insert into public.tile_types (id, label, description, icon, sort_order, is_active) values
    ('event_calendar', 'イベントカレンダー', '月表示カレンダーでイベントを紹介するタイル', 'fa-calendar-week', 10, true)
on conflict (id) do update set
    label = excluded.label,
    description = excluded.description,
    icon = excluded.icon,
    is_active = excluded.is_active;
