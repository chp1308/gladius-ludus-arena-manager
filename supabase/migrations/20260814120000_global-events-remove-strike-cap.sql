-- Remove the fixed per-fighter strikes cap entirely — pacing is now
-- purely cooldown-based (see GLOBAL_EVENT_STRIKE_COOLDOWN_SEC in
-- game.functions.ts), so striking faster/more consistently during the
-- live window is an actual skill rather than a fixed budget everyone
-- burns identically.
DROP FUNCTION IF EXISTS public.apply_global_event_strike(uuid, uuid, uuid, text, text, bigint, integer, integer);
CREATE FUNCTION public.apply_global_event_strike(
  p_event_id uuid,
  p_owner_id uuid,
  p_gladiator_id uuid,
  p_gladiator_name text,
  p_ludus_name text,
  p_damage bigint,
  p_cooldown_seconds integer
)
RETURNS TABLE (strikes_used integer, damage_dealt bigint, last_strike_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.global_event_contributions
    (event_id, owner_id, gladiator_id, gladiator_name, ludus_name, damage_dealt, strikes_used, last_strike_at)
  VALUES
    (p_event_id, p_owner_id, p_gladiator_id, p_gladiator_name, p_ludus_name, p_damage, 1, now())
  ON CONFLICT (event_id, owner_id, gladiator_id) DO UPDATE
    SET damage_dealt = global_event_contributions.damage_dealt + EXCLUDED.damage_dealt,
        strikes_used = global_event_contributions.strikes_used + 1,
        gladiator_name = EXCLUDED.gladiator_name,
        last_strike_at = now()
    WHERE global_event_contributions.last_strike_at IS NULL
       OR global_event_contributions.last_strike_at <= now() - make_interval(secs => p_cooldown_seconds);

  RETURN QUERY
    SELECT c.strikes_used, c.damage_dealt, c.last_strike_at FROM public.global_event_contributions c
    WHERE c.event_id = p_event_id AND c.owner_id = p_owner_id AND c.gladiator_id = p_gladiator_id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_global_event_strike FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_global_event_strike TO service_role;
