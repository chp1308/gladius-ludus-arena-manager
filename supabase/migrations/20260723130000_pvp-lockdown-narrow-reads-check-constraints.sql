
-- ============================================================
-- Follow-up hardening on top of 20260723120000:
--  1. pvp_challenges had the same gap as profiles/gladiators — RLS only
--     checked challenger_id = auth.uid(), placing no constraint on the
--     `rating` value itself. A player could post a challenge via devtools
--     with a deflated rating while fielding a genuinely strong gladiator,
--     luring weaker opponents into an unfair "similar match".
--  2. "read all profiles for pvp" exposed every column — including
--     denarii — to any authenticated user via a direct table read.
--  3. Defense-in-depth CHECK constraints, now that writes are centralized
--     behind the service-role client.
-- ============================================================

-- (1) Lock down pvp_challenges the same way as the other game-state tables.
-- All inserts/updates/deletes now go through the service-role client in
-- game.functions.ts, which computes `rating` server-side from the actual
-- gladiator's stats.
REVOKE INSERT, UPDATE, DELETE ON public.pvp_challenges FROM authenticated;

-- (2) Replace the broad cross-user profile read with SECURITY DEFINER
-- functions that return only the fields the leaderboard / PVP listing /
-- public-ludus screens actually use — denarii is never in the result set.
-- Each user's own full row (including denarii) is still readable via the
-- existing "own profile select" policy.
DROP POLICY IF EXISTS "read all profiles for pvp" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_pvp_profiles(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  ludus_name text,
  description text,
  bio text,
  reputation integer,
  best_rank integer,
  training_level integer,
  scouting_level integer,
  medicus_level integer,
  armory_level integer,
  pantry_level integer,
  showcase_limit integer,
  showcase_gladiator_ids uuid[],
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.ludus_name, p.description, p.bio, p.reputation, p.best_rank,
         p.training_level, p.scouting_level, p.medicus_level, p.armory_level, p.pantry_level,
         p.showcase_limit, p.showcase_gladiator_ids, p.created_at
  FROM public.profiles p
  WHERE p.id = ANY(p_ids);
$$;

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
  ORDER BY p.reputation DESC
  LIMIT LEAST(GREATEST(p_limit, 0), 100);
$$;

-- Read-only, no arguments that could target another user's writes — safe to
-- expose broadly, unlike spend_denarii.
REVOKE ALL ON FUNCTION public.get_pvp_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pvp_profiles(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_reputation_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reputation_leaderboard(integer) TO authenticated, service_role;

-- (3) Defense-in-depth CHECK constraints — cheap insurance against future
-- application bugs writing out-of-range values.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_denarii_nonneg CHECK (denarii >= 0),
  ADD CONSTRAINT profiles_reputation_nonneg CHECK (reputation >= 0),
  ADD CONSTRAINT profiles_training_level_range CHECK (training_level BETWEEN 1 AND 5),
  ADD CONSTRAINT profiles_scouting_level_range CHECK (scouting_level BETWEEN 1 AND 5),
  ADD CONSTRAINT profiles_medicus_level_range CHECK (medicus_level BETWEEN 1 AND 5),
  ADD CONSTRAINT profiles_armory_level_range CHECK (armory_level BETWEEN 1 AND 5),
  ADD CONSTRAINT profiles_pantry_level_range CHECK (pantry_level BETWEEN 1 AND 5);

ALTER TABLE public.gladiators
  ADD CONSTRAINT gladiators_weapon_tier_range CHECK (weapon_tier BETWEEN 0 AND 8),
  ADD CONSTRAINT gladiators_armor_tier_range CHECK (armor_tier BETWEEN 0 AND 8),
  ADD CONSTRAINT gladiators_helmet_tier_range CHECK (helmet_tier BETWEEN 0 AND 8),
  ADD CONSTRAINT gladiators_legs_tier_range CHECK (legs_tier BETWEEN 0 AND 8),
  ADD CONSTRAINT gladiators_offhand_tier_range CHECK (offhand_tier BETWEEN 0 AND 8),
  ADD CONSTRAINT gladiators_level_positive CHECK (level >= 1),
  ADD CONSTRAINT gladiators_experience_nonneg CHECK (experience >= 0),
  ADD CONSTRAINT gladiators_wins_nonneg CHECK (wins >= 0),
  ADD CONSTRAINT gladiators_losses_nonneg CHECK (losses >= 0),
  ADD CONSTRAINT gladiators_health_nonneg CHECK (health >= 0),
  ADD CONSTRAINT gladiators_stats_nonneg CHECK (strength >= 0 AND agility >= 0 AND stamina >= 0 AND technique >= 0);

ALTER TABLE public.ludus_skills
  ADD CONSTRAINT ludus_skills_level_range CHECK (level BETWEEN 0 AND 5);
