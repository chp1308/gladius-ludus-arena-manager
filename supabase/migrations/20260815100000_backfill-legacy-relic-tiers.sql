-- Backfills relic_tiers for accounts that already owned a tiered relic
-- (titan_shard) from before tier tracking existed (added in
-- 20260814100000_global-events-multi-fighter-relic-tiers.sql). Those
-- accounts have relics containing 'titan_shard' but no matching
-- relic_tiers entry, which the Temple of Relics panel displayed as "Tier
-- 1/5" (its own fallback default) while globalEventMaxFighters — which
-- only reads relic_tiers, defaulting missing entries to 0 — actually
-- granted just the base 1 fighter slot. Backfilling to tier 1 here
-- matches what those accounts were already shown, rather than quietly
-- downgrading the display to what the server actually granted.
UPDATE public.profiles
SET relic_tiers = jsonb_set(coalesce(relic_tiers, '{}'::jsonb), '{titan_shard}', '1', true)
WHERE 'titan_shard' = ANY(relics)
  AND coalesce((relic_tiers->>'titan_shard')::int, 0) = 0;
