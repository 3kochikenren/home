-- Add extra event-related fields for news registration/editing.
ALTER TABLE public.news
    ADD COLUMN IF NOT EXISTS reception_time time,
    ADD COLUMN IF NOT EXISTS start_time time,
    ADD COLUMN IF NOT EXISTS end_time time,
    ADD COLUMN IF NOT EXISTS venue_name text,
    ADD COLUMN IF NOT EXISTS venue_address text,
    ADD COLUMN IF NOT EXISTS participation_fee text,
    ADD COLUMN IF NOT EXISTS application_url text;
