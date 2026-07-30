-- BOSS FIGHTS — reflex-driven PvE encounters. A fight is a short-lived
-- session (boss_fight_sessions) that advances one round at a time: the
-- server telegraphs a beat ("vulnerable" or "defensive"), the player
-- chooses to strike or hold, and the round is scored server-side against
-- its own deadline (so a late/absent response always resolves as a hold,
-- never trusting a client-reported timestamp). Only one session can be
-- in flight per player. Finished attempts are archived to boss_attempts,
-- which also doubles as the source of the 24h per-boss cooldown (same
-- lazy-timestamp pattern as pit fights and Cursus Honorum).

CREATE TABLE public.boss_fight_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  boss_key TEXT NOT NULL,
  gladiator_ids UUID[] NOT NULL,
  phase INTEGER NOT NULL DEFAULT 1,
  team_power INTEGER NOT NULL,
  boss_hp INTEGER NOT NULL,
  boss_max_hp INTEGER NOT NULL,
  party_hp INTEGER NOT NULL,
  party_max_hp INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 0,
  beat_type TEXT NOT NULL,
  round_deadline TIMESTAMPTZ NOT NULL,
  log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live encounter per player at a time.
CREATE UNIQUE INDEX boss_fight_sessions_owner_uniq ON public.boss_fight_sessions(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boss_fight_sessions TO authenticated;
GRANT ALL ON public.boss_fight_sessions TO service_role;
ALTER TABLE public.boss_fight_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own boss session all" ON public.boss_fight_sessions FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
-- Same lockdown as every other game-state table: all writes route through
-- the service-role client in game.functions.ts.
REVOKE INSERT, UPDATE, DELETE ON public.boss_fight_sessions FROM authenticated;

CREATE TABLE public.boss_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  boss_key TEXT NOT NULL,
  gladiator_ids UUID[] NOT NULL,
  won BOOLEAN NOT NULL,
  denarii_gained INTEGER NOT NULL DEFAULT 0,
  xp_gained INTEGER NOT NULL DEFAULT 0,
  reputation_gained INTEGER NOT NULL DEFAULT 0,
  log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX boss_attempts_owner_boss_idx ON public.boss_attempts(owner_id, boss_key, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boss_attempts TO authenticated;
GRANT ALL ON public.boss_attempts TO service_role;
ALTER TABLE public.boss_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own boss attempts all" ON public.boss_attempts FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
REVOKE INSERT, UPDATE, DELETE ON public.boss_attempts FROM authenticated;
