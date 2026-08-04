-- Public "who has the most confirmed kills of each boss" leaderboard for
-- the Hall of Champions page. Unpacks every profile's boss_kills jsonb
-- (private column, never exposed directly) and returns only the single
-- top ludus per boss_key — same narrow-read pattern as get_pvp_profiles /
-- get_reputation_leaderboard, so no other profile data leaks.
CREATE OR REPLACE FUNCTION public.get_boss_kill_leaderboard()
RETURNS TABLE (
  boss_key text,
  owner_id uuid,
  ludus_name text,
  kills integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (bk.boss_key)
    bk.boss_key,
    p.id AS owner_id,
    p.ludus_name,
    bk.kills
  FROM public.profiles p,
       LATERAL (
         SELECT kv.key AS boss_key, kv.value::integer AS kills
         FROM jsonb_each_text(p.boss_kills) AS kv(key, value)
       ) AS bk
  WHERE bk.kills > 0
  ORDER BY bk.boss_key, bk.kills DESC, p.ludus_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_boss_kill_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_boss_kill_leaderboard() TO authenticated, service_role;
