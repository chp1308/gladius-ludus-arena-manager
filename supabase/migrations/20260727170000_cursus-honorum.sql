-- CURSUS HONORUM — a 6th upgradeable facility (social_level) plus a log
-- table of social-event outcomes, doubling as the source of truth for the
-- shared 30-minute cooldown (same lazy-timestamp pattern as pit fights —
-- the most recent row's created_at, no separate cooldown column needed).
ALTER TABLE public.profiles
  ADD COLUMN social_level INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT profiles_social_level_range CHECK (social_level BETWEEN 1 AND 5);

CREATE TABLE public.social_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  tone TEXT NOT NULL,
  gladiator_names TEXT[] NOT NULL,
  log TEXT NOT NULL,
  denarii_delta INTEGER NOT NULL DEFAULT 0,
  reputation_delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX social_events_owner_idx ON public.social_events(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_events TO authenticated;
GRANT ALL ON public.social_events TO service_role;
ALTER TABLE public.social_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own social events all" ON public.social_events FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Same lockdown as every other game-state table: all writes route through
-- the service-role client in game.functions.ts, which recomputes cooldowns,
-- rolls, and reward amounts server-side rather than trusting client input.
REVOKE INSERT, UPDATE, DELETE ON public.social_events FROM authenticated;
