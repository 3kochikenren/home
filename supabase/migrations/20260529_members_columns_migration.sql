-- members table migration for official columns
-- Run in Supabase SQL Editor

BEGIN;

-- 1) Add official columns
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_type text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS election_district text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS vote_date date;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_deleted boolean;

-- 2) Backfill from legacy bio metadata when columns are null
WITH parsed AS (
    SELECT
        id,
        (regexp_match(COALESCE(bio, ''), '(?m)^__CATEGORY__:(.+)$'))[1] AS p_member_type,
        (regexp_match(COALESCE(bio, ''), '(?m)^__DISTRICT__:(.+)$'))[1] AS p_election_district,
        (regexp_match(COALESCE(bio, ''), '(?m)^__VOTE_DATE__:(.+)$'))[1] AS p_vote_date,
        (regexp_match(COALESCE(bio, ''), '(?m)^__DELETED__:(.+)$'))[1] AS p_is_deleted
    FROM public.members
)
UPDATE public.members m
SET
    member_type = COALESCE(
        m.member_type,
        CASE
            WHEN parsed.p_member_type IN ('議員', '候補者', '改革委員') THEN parsed.p_member_type
            ELSE '議員'
        END
    ),
    election_district = COALESCE(m.election_district, NULLIF(parsed.p_election_district, '')),
    vote_date = COALESCE(
        m.vote_date,
        CASE
            WHEN parsed.p_vote_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN parsed.p_vote_date::date
            ELSE NULL
        END
    ),
    is_deleted = COALESCE(
        m.is_deleted,
        CASE
            WHEN parsed.p_is_deleted = '1' THEN true
            WHEN parsed.p_is_deleted = '0' THEN false
            ELSE false
        END
    )
FROM parsed
WHERE m.id = parsed.id;

-- 3) Remove legacy metadata from bio (keep only plain profile text)
UPDATE public.members
SET bio = NULLIF(
    BTRIM(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(COALESCE(bio, ''), '(?m)^__CATEGORY__:.*$', '', 'g'),
                    '(?m)^__DELETED__:.*$', '', 'g'
                ),
                '(?m)^__DISTRICT__:.*$', '', 'g'
            ),
            '(?m)^__VOTE_DATE__:.*$', '', 'g'
        )
    ),
    ''
)
WHERE COALESCE(bio, '') ~ '(?m)^__(CATEGORY|DELETED|DISTRICT|VOTE_DATE)__:';

-- 4) Normalize defaults and constraints
UPDATE public.members SET member_type = '議員' WHERE member_type IS NULL OR member_type = '';
UPDATE public.members SET is_deleted = false WHERE is_deleted IS NULL;

ALTER TABLE public.members ALTER COLUMN member_type SET DEFAULT '議員';
ALTER TABLE public.members ALTER COLUMN is_deleted SET DEFAULT false;
ALTER TABLE public.members ALTER COLUMN member_type SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN is_deleted SET NOT NULL;

-- Optional validation: restrict category values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'members_member_type_check'
          AND conrelid = 'public.members'::regclass
    ) THEN
        ALTER TABLE public.members
        ADD CONSTRAINT members_member_type_check
        CHECK (member_type IN ('議員', '候補者', '改革委員'));
    END IF;
END $$;

-- Optional helpful index
CREATE INDEX IF NOT EXISTS idx_members_is_deleted_sort_order
ON public.members (is_deleted, sort_order);

COMMIT;
