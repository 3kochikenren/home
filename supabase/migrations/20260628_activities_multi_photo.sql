-- activities テーブルに写真2・写真3カラムを追加
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS photo_url2 TEXT;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS photo_url3 TEXT;
