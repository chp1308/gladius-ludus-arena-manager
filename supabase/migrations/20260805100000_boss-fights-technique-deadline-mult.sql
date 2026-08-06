-- The party's average Technique widens boss-fight reaction windows (up to
-- 2x at full stat-cap development) — frozen at fight start, same reasoning
-- as shield_map/armor_reduction: a mid-fight training session shouldn't
-- retroactively change the timing of a round already in flight.
ALTER TABLE public.boss_fight_sessions
  ADD COLUMN deadline_mult NUMERIC NOT NULL DEFAULT 1;
