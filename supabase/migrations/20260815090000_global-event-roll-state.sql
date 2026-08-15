-- Tracks when ensureGlobalEventRoll last checked, so the roll chance can
-- be computed from real elapsed wall-clock time (an exponential/Poisson
-- process) instead of a flat per-poll chance. A flat chance ties
-- real-world event frequency to how often the app happens to get polled
-- (i.e. to player traffic), which drifts as the player count changes —
-- see ensureGlobalEventRoll in game.functions.ts. Internal bookkeeping
-- only, never read by clients.
CREATE TABLE public.global_event_roll_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.global_event_roll_state (id, last_checked_at) VALUES (1, now());

ALTER TABLE public.global_event_roll_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.global_event_roll_state TO service_role;
