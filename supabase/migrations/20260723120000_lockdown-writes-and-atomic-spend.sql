
-- SECURITY: the app's cost checks, stat caps, and armory gates only ever lived
-- in game.functions.ts. RLS policies like "own gladiators all" only verify
-- auth.uid() = owner_id — they place no constraint on the values a player
-- writes, so any authenticated client could call the Supabase REST/JS API
-- directly and set denarii, stats, or gear tiers to anything. The frontend
-- never calls supabase.from(...) directly (everything routes through the
-- server functions in game.functions.ts), so the authenticated role does not
-- need write access to these tables at all. Every mutation now goes through
-- the service-role client (supabaseAdmin) inside the server functions, which
-- re-check ownership explicitly via .eq("owner_id", userId) / .eq("id", userId).
REVOKE INSERT, UPDATE, DELETE ON public.profiles, public.gladiators, public.ludus_skills, public.hall_of_fame FROM authenticated;

-- Atomic denarii debit: guards against read-then-write races (double-click,
-- two tabs) where two concurrent requests read the same starting balance and
-- both write, losing or duplicating a spend. Returns the new balance, or no
-- row (NULL) if the balance was insufficient.
CREATE OR REPLACE FUNCTION public.spend_denarii(p_user uuid, p_amount integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET denarii = denarii - p_amount
  WHERE id = p_user AND denarii >= p_amount
  RETURNING denarii;
$$;

-- SECURITY DEFINER + an arbitrary p_user param means any caller able to
-- execute this could drain any account's balance — restrict execution to
-- the service role, same as the other SECURITY DEFINER functions here.
REVOKE ALL ON FUNCTION public.spend_denarii(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_denarii(uuid, integer) TO service_role;
