ALTER TABLE public.gladiators
  ADD COLUMN IF NOT EXISTS helmet_tier smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS legs_tier smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS offhand_tier smallint NOT NULL DEFAULT 1;