-- 施設マスタ
CREATE TABLE IF NOT EXISTS public.tabloid_facilities (
    id BIGSERIAL PRIMARY KEY,
    can_place BOOLEAN DEFAULT TRUE,
    facility_name TEXT NOT NULL,
    category TEXT DEFAULT 'その他',
    postal_code TEXT,
    address_pref TEXT,
    address_city TEXT,
    address_other TEXT,
    phone TEXT,
    contact_person TEXT,
    status TEXT,
    rejection_reason TEXT,
    contact_member TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- タブロイド号管理
CREATE TABLE IF NOT EXISTS public.tabloid_issues (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    created_by TEXT,
    issue_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 配置状況
CREATE TABLE IF NOT EXISTS public.tabloid_placements (
    id BIGSERIAL PRIMARY KEY,
    issue_id BIGINT REFERENCES public.tabloid_issues(id) ON DELETE CASCADE,
    facility_id BIGINT REFERENCES public.tabloid_facilities(id) ON DELETE CASCADE,
    placed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(issue_id, facility_id)
);

-- RLS
ALTER TABLE public.tabloid_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabloid_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabloid_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full tabloid_facilities" ON public.tabloid_facilities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full tabloid_issues" ON public.tabloid_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full tabloid_placements" ON public.tabloid_placements FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tabloid_facilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tabloid_issues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tabloid_placements TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tabloid_facilities_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tabloid_issues_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tabloid_placements_id_seq TO authenticated;
