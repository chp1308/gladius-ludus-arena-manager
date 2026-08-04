-- Tracks the highest tier already paid out per achievement category, so
-- getAchievementProgress can grant a one-time denarii reward the first time
-- each tier is reached (100/200/300/400/500 for tiers 1-5) without
-- re-paying on every subsequent load, and without losing the reward if
-- progress for a fluctuating stat (denarii held, beasts owned) later dips
-- back below a tier it already cleared. Starts empty for every profile —
-- including existing ones — so already-earned tiers pay out retroactively
-- the first time this runs.
ALTER TABLE public.profiles
  ADD COLUMN achievement_tiers_claimed jsonb NOT NULL DEFAULT '{}'::jsonb;
