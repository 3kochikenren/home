-- Add target audience field for news/event registration form.
ALTER TABLE public.news
    ADD COLUMN IF NOT EXISTS target_audience text;
