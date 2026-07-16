
-- Facility levels on the ludus (profile)
ALTER TABLE public.profiles
  ADD COLUMN training_level integer NOT NULL DEFAULT 1,
  ADD COLUMN scouting_level integer NOT NULL DEFAULT 1,
  ADD COLUMN medicus_level integer NOT NULL DEFAULT 1,
  ADD COLUMN armory_level integer NOT NULL DEFAULT 1;

-- Gladiator weapon type + beast flag
ALTER TABLE public.gladiators
  ADD COLUMN weapon_type text NOT NULL DEFAULT 'gladius',
  ADD COLUMN is_beast boolean NOT NULL DEFAULT false;

-- Skill tree per weapon type
CREATE TABLE public.ludus_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  weapon_type text NOT NULL,
  level integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, weapon_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ludus_skills TO authenticated;
GRANT ALL ON public.ludus_skills TO service_role;

ALTER TABLE public.ludus_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ludus_skills all"
  ON public.ludus_skills FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER ludus_skills_updated_at
  BEFORE UPDATE ON public.ludus_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
