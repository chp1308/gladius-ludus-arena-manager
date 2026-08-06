-- Temple of Relics extends past the shared facility cap, same as Training
-- Yard: levels 6-10 unlock, alternating which of its two effects each new
-- level improves (odd levels cut boss-fight cooldown, even levels raise
-- key-drop chance — see relicsCooldownHours/keyDropChance in
-- game.functions.ts).
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_relics_level_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_relics_level_range CHECK (relics_level BETWEEN 1 AND 10);
