-- Armory ("Foundry") now extends past the shared facility cap of 5 up to
-- 10, matching Training Yard and Temple of Relics, and gear tiers extend
-- from 8 to 20 (2 tiers unlock per Foundry level, same ratio the original
-- version used — see requiredArmoryLevel in game.functions.ts). Existing
-- armory levels and gear tiers are already valid under the wider range.
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_armory_level_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_armory_level_range CHECK (armory_level BETWEEN 1 AND 10);

ALTER TABLE public.gladiators
  DROP CONSTRAINT gladiators_weapon_tier_range,
  DROP CONSTRAINT gladiators_armor_tier_range,
  DROP CONSTRAINT gladiators_helmet_tier_range,
  DROP CONSTRAINT gladiators_legs_tier_range,
  DROP CONSTRAINT gladiators_offhand_tier_range;

ALTER TABLE public.gladiators
  ADD CONSTRAINT gladiators_weapon_tier_range CHECK (weapon_tier BETWEEN 0 AND 20),
  ADD CONSTRAINT gladiators_armor_tier_range CHECK (armor_tier BETWEEN 0 AND 20),
  ADD CONSTRAINT gladiators_helmet_tier_range CHECK (helmet_tier BETWEEN 0 AND 20),
  ADD CONSTRAINT gladiators_legs_tier_range CHECK (legs_tier BETWEEN 0 AND 20),
  ADD CONSTRAINT gladiators_offhand_tier_range CHECK (offhand_tier BETWEEN 0 AND 20);
