-- Multi-fighter support: a relic can now let a player field more than one
-- gladiator at a global event, so each selected fighter gets its own
-- contribution row (PK widened to include gladiator_id). gladiator_id was
-- already always provided by strikeGlobalEvent, so it's safe to make
-- required; the FK reference is dropped (not re-added) since
-- gladiator_name/ludus_name are already point-in-time snapshots for the
-- same reason — a gladiator dismissed after the event shouldn't invalidate
-- historical results.
ALTER TABLE public.global_event_contributions
  DROP CONSTRAINT global_event_contributions_gladiator_id_fkey,
  ALTER COLUMN gladiator_id SET NOT NULL,
  DROP CONSTRAINT global_event_contributions_pkey,
  ADD PRIMARY KEY (event_id, owner_id, gladiator_id);

-- Global events now pay out XP per fighter alongside denarii.
ALTER TABLE public.global_event_contributions
  ADD COLUMN reward_xp INTEGER;

-- Per-player tier for tiered relics (currently just titan_shard, 0-5, each
-- tier granting +1 max fighter at a global event). General JSONB map
-- (relic_key -> tier) rather than a dedicated column per relic, since more
-- tiered rewards are planned.
ALTER TABLE public.profiles
  ADD COLUMN relic_tiers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- apply_global_event_strike's conflict target now includes gladiator_id,
-- matching the widened primary key — each fighter's strike cap is still
-- guarded atomically the same way (the WHERE clause on DO UPDATE).
CREATE OR REPLACE FUNCTION public.apply_global_event_strike(
  p_event_id uuid,
  p_owner_id uuid,
  p_gladiator_id uuid,
  p_gladiator_name text,
  p_ludus_name text,
  p_damage bigint,
  p_max_strikes integer
)
RETURNS TABLE (strikes_used integer, damage_dealt bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.global_event_contributions
    (event_id, owner_id, gladiator_id, gladiator_name, ludus_name, damage_dealt, strikes_used)
  VALUES
    (p_event_id, p_owner_id, p_gladiator_id, p_gladiator_name, p_ludus_name, p_damage, 1)
  ON CONFLICT (event_id, owner_id, gladiator_id) DO UPDATE
    SET damage_dealt = global_event_contributions.damage_dealt + EXCLUDED.damage_dealt,
        strikes_used = global_event_contributions.strikes_used + 1,
        gladiator_name = EXCLUDED.gladiator_name
    WHERE global_event_contributions.strikes_used < p_max_strikes;

  RETURN QUERY
    SELECT c.strikes_used, c.damage_dealt FROM public.global_event_contributions c
    WHERE c.event_id = p_event_id AND c.owner_id = p_owner_id AND c.gladiator_id = p_gladiator_id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_global_event_strike FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_global_event_strike TO service_role;
