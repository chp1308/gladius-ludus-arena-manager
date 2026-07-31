-- Pit-fight charges aren't a stored counter — availability is computed by
-- counting how many pit-fight rows a gladiator has within the rolling
-- cooldown window. To "refund" a charge when a fight levels a gladiator up,
-- flag that match row so it's excluded from the count, without losing it
-- from fight history/logs.
ALTER TABLE public.matches
  ADD COLUMN refunded_charge BOOLEAN NOT NULL DEFAULT false;
