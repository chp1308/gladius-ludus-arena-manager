-- Temple of Relics becomes an upgradeable facility (levels 1-5, same shared
-- cost curve as the other facilities) governing the drop chance of "key"
-- loot (e.g. Key to Hades from Cerberus) — a stackable consumable, tracked
-- separately from the one-time permanent relics in profiles.relics.
ALTER TABLE public.profiles
  ADD COLUMN relics_level integer NOT NULL DEFAULT 1,
  ADD COLUMN hades_keys integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_relics_level_range CHECK (relics_level BETWEEN 1 AND 5),
  ADD CONSTRAINT profiles_hades_keys_nonneg CHECK (hades_keys >= 0);
