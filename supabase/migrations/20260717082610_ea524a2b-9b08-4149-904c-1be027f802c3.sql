
ALTER TABLE public.gladiators
  ADD COLUMN IF NOT EXISTS total_invested integer NOT NULL DEFAULT 0;

CREATE TABLE public.hall_of_fame (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  class text NOT NULL,
  weapon_type text NOT NULL,
  is_beast boolean NOT NULL DEFAULT false,
  level integer NOT NULL DEFAULT 1,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  total_invested integer NOT NULL DEFAULT 0,
  epitaph text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hall_of_fame TO authenticated;
GRANT ALL ON public.hall_of_fame TO service_role;

ALTER TABLE public.hall_of_fame ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own hall_of_fame all"
  ON public.hall_of_fame
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
