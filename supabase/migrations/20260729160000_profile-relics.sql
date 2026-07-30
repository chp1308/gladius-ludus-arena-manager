-- Permanent account-wide relics found as rare boss loot (e.g. a gold-gain
-- trinket) — unlike gear, these aren't per-gladiator and aren't re-rolled
-- once owned. See src/lib/relics.ts for the catalog and bonus math.
ALTER TABLE public.profiles
  ADD COLUMN relics TEXT[] NOT NULL DEFAULT '{}';
