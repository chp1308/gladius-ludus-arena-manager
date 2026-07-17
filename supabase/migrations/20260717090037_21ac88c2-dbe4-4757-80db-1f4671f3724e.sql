CREATE TABLE public.pvp_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id UUID NOT NULL,
  challenger_gladiator_id UUID NOT NULL REFERENCES public.gladiators(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  to_death BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  opponent_id UUID,
  opponent_gladiator_id UUID REFERENCES public.gladiators(id) ON DELETE SET NULL,
  winner_owner_id UUID,
  log JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pvp_challenges TO authenticated;
GRANT ALL ON public.pvp_challenges TO service_role;

ALTER TABLE public.pvp_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read all open challenges"
  ON public.pvp_challenges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "challenger inserts own"
  ON public.pvp_challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "challenger updates own"
  ON public.pvp_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = challenger_id)
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "challenger deletes own"
  ON public.pvp_challenges FOR DELETE
  TO authenticated
  USING (auth.uid() = challenger_id);

CREATE INDEX pvp_challenges_open_idx ON public.pvp_challenges (status, rating) WHERE status = 'open';