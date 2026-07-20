
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS showcase_limit integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS showcase_gladiator_ids uuid[] NOT NULL DEFAULT '{}';
