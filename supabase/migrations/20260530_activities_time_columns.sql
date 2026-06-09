-- Add start_time and end_time columns to activities table
alter table public.activities
    add column if not exists start_time time,
    add column if not exists end_time time;
