-- Global events — a shared, timed spectacle every ludus can join (see
-- ensureGlobalEventRoll/resolveGlobalEventIfDue/strikeGlobalEvent in
-- game.functions.ts). No shared/contended counter here on purpose: the
-- "boss HP" shown to players is a client-side animation derived from
-- starts_at/ends_at, not a real damage total, so there's nothing for
-- concurrent strikes to race on — each player's contribution row is only
-- ever written by that player.
CREATE TABLE public.global_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monster_key TEXT NOT NULL DEFAULT 'porphyrion',
  status TEXT NOT NULL DEFAULT 'announced' CHECK (status IN ('announced', 'live', 'resolved')),
  announced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  total_pool INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Only ever expect one announced/live event at a time (ensureGlobalEventRoll
-- skips the roll otherwise), but nothing here enforces that at the DB level
-- since the check-then-insert already happens inside a single server
-- function call, not a hot path worth a partial unique index for.
CREATE INDEX global_events_status_idx ON public.global_events (status);

CREATE TABLE public.global_event_contributions (
  event_id UUID NOT NULL REFERENCES public.global_events(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  gladiator_id UUID REFERENCES public.gladiators(id) ON DELETE SET NULL,
  -- Snapshot the names rather than joining live — the gladiator (or its
  -- name) can change or be dismissed before the leaderboard is shown.
  gladiator_name TEXT NOT NULL,
  ludus_name TEXT NOT NULL,
  damage_dealt BIGINT NOT NULL DEFAULT 0,
  strikes_used INTEGER NOT NULL DEFAULT 0,
  reward_denarii INTEGER,
  PRIMARY KEY (event_id, owner_id)
);
CREATE INDEX global_event_contributions_leaderboard_idx ON public.global_event_contributions (event_id, damage_dealt DESC);

-- Public spectacle data — every authenticated user can read both tables in
-- full (there's nothing sensitive here, unlike profiles/gladiators). All
-- writes route through the service-role client in game.functions.ts, same
-- lockdown as every other game-state table.
GRANT SELECT ON public.global_events TO authenticated;
GRANT ALL ON public.global_events TO service_role;
ALTER TABLE public.global_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all global events" ON public.global_events FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.global_event_contributions TO authenticated;
GRANT ALL ON public.global_event_contributions TO service_role;
ALTER TABLE public.global_event_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all global event contributions" ON public.global_event_contributions FOR SELECT TO authenticated USING (true);

-- Atomic insert-or-increment for a single strike, so a burst of concurrent
-- requests from the same player (double-clicked Strike) can't push
-- strikes_used past p_max_strikes — the ON CONFLICT ... WHERE guard makes
-- the whole insert-or-update a single serialized statement per row.
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
  ON CONFLICT (event_id, owner_id) DO UPDATE
    SET damage_dealt = global_event_contributions.damage_dealt + EXCLUDED.damage_dealt,
        strikes_used = global_event_contributions.strikes_used + 1,
        gladiator_id = EXCLUDED.gladiator_id,
        gladiator_name = EXCLUDED.gladiator_name
    WHERE global_event_contributions.strikes_used < p_max_strikes;

  RETURN QUERY
    SELECT c.strikes_used, c.damage_dealt FROM public.global_event_contributions c
    WHERE c.event_id = p_event_id AND c.owner_id = p_owner_id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_global_event_strike FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_global_event_strike TO service_role;
