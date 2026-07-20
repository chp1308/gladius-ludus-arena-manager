
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS best_rank integer;
ALTER TABLE public.gladiators ADD COLUMN IF NOT EXISTS best_rank integer;
