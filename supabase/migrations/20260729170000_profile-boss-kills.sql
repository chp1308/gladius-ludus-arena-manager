-- Per-boss lifetime kill counts, used to unlock kill-count-gated relic
-- bonus tiers (e.g. an extra +2.5% gold bonus at 25+ kills of a given
-- boss). Keyed by boss_key so it scales to future bosses without a new
-- column each time.
ALTER TABLE public.profiles
  ADD COLUMN boss_kills JSONB NOT NULL DEFAULT '{}'::jsonb;
