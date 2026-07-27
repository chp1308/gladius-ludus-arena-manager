-- Tracks when a gladiator's stored health was last written, so current
-- health can be derived lazily (stored value + elapsed regen) without a
-- cron job. Existing rows backfill to "now" — nobody gets free retroactive
-- regen credited for time before this migration ran.
ALTER TABLE public.gladiators ADD COLUMN health_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
