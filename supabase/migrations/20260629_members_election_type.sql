-- members テーブルに選挙種類カラムを追加
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS election_type TEXT;
