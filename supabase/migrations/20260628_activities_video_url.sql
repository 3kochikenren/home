-- activities テーブルに動画URLカラムを追加
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS video_url TEXT;
