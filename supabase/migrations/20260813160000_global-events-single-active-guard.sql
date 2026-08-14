-- ensureGlobalEventRoll's "is there an active event?" check and its INSERT
-- aren't atomic (two separate statements), so two near-simultaneous
-- opportunistic callers (e.g. the global banner and the Fights page both
-- loading at once) can both pass the check and both insert an event. This
-- partial unique index makes it impossible to have more than one row in
-- ('announced', 'live') at a time — the losing INSERT gets a 23505
-- unique_violation, which ensureGlobalEventRoll now catches and ignores.
CREATE UNIQUE INDEX global_events_single_active_idx
  ON public.global_events ((1))
  WHERE status IN ('announced', 'live');
