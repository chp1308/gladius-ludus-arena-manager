-- Cerberus's snake bite poisons the party on a failed dodge: the next 3
-- attacks that actually land take double damage. Persisted server-side
-- (not just returned to the client) since it has to survive across the
-- request-per-round flow the same way shield_map/armor_reduction do.
ALTER TABLE public.boss_fight_sessions
  ADD COLUMN poison_stacks INTEGER NOT NULL DEFAULT 0;
