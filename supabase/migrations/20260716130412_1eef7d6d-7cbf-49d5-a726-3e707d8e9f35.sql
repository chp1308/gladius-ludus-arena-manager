
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  ludus_name TEXT NOT NULL DEFAULT 'Ludus Novus',
  denarii INTEGER NOT NULL DEFAULT 500,
  reputation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- GLADIATORS
CREATE TABLE public.gladiators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT 'Murmillo',
  strength INTEGER NOT NULL DEFAULT 5,
  agility INTEGER NOT NULL DEFAULT 5,
  stamina INTEGER NOT NULL DEFAULT 5,
  technique INTEGER NOT NULL DEFAULT 5,
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  health INTEGER NOT NULL DEFAULT 100,
  injury_until TIMESTAMPTZ,
  weapon_tier INTEGER NOT NULL DEFAULT 0,
  armor_tier INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX gladiators_owner_idx ON public.gladiators(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gladiators TO authenticated;
GRANT ALL ON public.gladiators TO service_role;
ALTER TABLE public.gladiators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gladiators all" ON public.gladiators FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- MATCHES
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  gladiator_id UUID NOT NULL REFERENCES public.gladiators ON DELETE CASCADE,
  opponent_name TEXT NOT NULL,
  opponent_power INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  result TEXT NOT NULL,
  xp_gained INTEGER NOT NULL DEFAULT 0,
  denarii_gained INTEGER NOT NULL DEFAULT 0,
  reputation_gained INTEGER NOT NULL DEFAULT 0,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matches_owner_idx ON public.matches(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own matches all" ON public.matches FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, ludus_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'ludus_name', 'Ludus of ' || split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
