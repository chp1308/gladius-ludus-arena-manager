-- Marks profiles seeded as PvP/pit-fight filler opponents so they can be
-- excluded from player-facing rankings while still fully participating in
-- PvP (ensureBotChallenges treats any owner with idle gladiators as a valid
-- challenge source, bot or real, so no other game logic needs to change).
ALTER TABLE public.profiles ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_reputation_leaderboard(p_limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  ludus_name text,
  reputation integer,
  best_rank integer,
  training_level integer,
  scouting_level integer,
  medicus_level integer,
  armory_level integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.ludus_name, p.reputation, p.best_rank,
         p.training_level, p.scouting_level, p.medicus_level, p.armory_level
  FROM public.profiles p
  WHERE NOT p.is_bot
  ORDER BY p.reputation DESC
  LIMIT LEAST(GREATEST(p_limit, 0), 100);
$$;
