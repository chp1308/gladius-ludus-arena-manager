-- Cerberus doesn't use the boar's fixed 4-beat rotation — each round is one
-- attack in a variable-length "burst" (2 attacks in the first HP band, 3-4
-- in the second, an escalating 3-6 in the last) before a single strike
-- window opens. burst_length is rolled once when a burst starts; burst_index
-- tracks progress through it. Both are unused (left at 0) by the boar.
ALTER TABLE public.boss_fight_sessions
  ADD COLUMN burst_length INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN burst_index INTEGER NOT NULL DEFAULT 0;
