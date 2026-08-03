-- Training Yard alone now goes past the shared facility cap of 5, up to 10,
-- so gladiator stats can be trained to a cap of 100. Every other facility
-- (scouting/medicus/armory/pantry/social) keeps its existing BETWEEN 1 AND 5
-- constraint untouched.
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_training_level_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_training_level_range CHECK (training_level BETWEEN 1 AND 10);
