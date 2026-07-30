-- Adds the per-gladiator shield lookup (frozen at fight start, so gear
-- changes mid-fight can't retroactively alter a live encounter), the
-- frozen per-second armor-mitigation value used by the boss's passive tick
-- damage, and the gladiator names needed to narrate per-gladiator
-- block/dodge outcomes without re-fetching the roster every round.
ALTER TABLE public.boss_fight_sessions
  ADD COLUMN shield_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN armor_reduction INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN gladiator_names TEXT[] NOT NULL DEFAULT '{}';
