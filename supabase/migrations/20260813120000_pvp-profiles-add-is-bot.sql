-- get_pvp_profiles needs to expose is_bot so the PvP challenge list can
-- distinguish real players from bot-seeded filler and let players sort/
-- filter by it. Return types can't be changed in place with CREATE OR
-- REPLACE, so drop first.
DROP FUNCTION IF EXISTS public.get_pvp_profiles(uuid[]);
CREATE FUNCTION public.get_pvp_profiles(p_ids uuid[])
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
  social_level integer,
  showcase_limit integer,
  showcase_gladiator_ids uuid[],
  created_at timestamptz,
  is_bot boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.ludus_name, p.description, p.bio, p.reputation, p.best_rank,
         p.training_level, p.scouting_level, p.medicus_level, p.armory_level, p.pantry_level,
         p.social_level, p.showcase_limit, p.showcase_gladiator_ids, p.created_at, p.is_bot
  FROM public.profiles p
  WHERE p.id = ANY(p_ids);
$$;
REVOKE ALL ON FUNCTION public.get_pvp_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pvp_profiles(uuid[]) TO authenticated, service_role;
