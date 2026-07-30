-- Records which named loot-table entries actually hit on each boss attempt
-- (one array entry per successful roll — a fight where two gladiators both
-- win their gear-chance roll pushes "gear" twice), so the client can show a
-- personal "times obtained" counter per item without re-deriving it from
-- free-text log lines.
ALTER TABLE public.boss_attempts
  ADD COLUMN loot_drops TEXT[] NOT NULL DEFAULT '{}';
