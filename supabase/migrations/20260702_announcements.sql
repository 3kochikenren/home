-- お知らせ情報テーブル
CREATE TABLE IF NOT EXISTS public.announcements (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    title_color TEXT DEFAULT '#1f2937',
    title_size TEXT DEFAULT 'lg',
    published_date DATE NOT NULL,
    content TEXT,
    content_color TEXT DEFAULT '#4b5563',
    content_size TEXT DEFAULT 'sm',
    image_url TEXT,
    link_url TEXT,
    end_date DATE NOT NULL,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read announcements"
    ON public.announcements FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated full access announcements"
    ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.announcements_id_seq TO authenticated;
