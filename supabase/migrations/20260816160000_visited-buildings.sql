-- Persistent "have you ever opened this building" tracking — separate from
-- discovered_buildings (which controls visibility). Powers a lasting
-- reminder/visualization on the map so players keep discovering everything
-- the game contains, not just a one-time tutorial animation, and also
-- gates the tutorial's "go visit Cursus Honorum" / "go visit Ludus
-- Grounds" steps (skipped if already visited by the time they're reached).
alter table public.profiles
  add column visited_buildings text[] not null default '{}';

-- Existing accounts have obviously used everything already — backfill to
-- the full building list so nobody who's already playing sees a sudden
-- "unvisited" reminder on buildings they've opened hundreds of times.
update public.profiles
set visited_buildings = array[
  'ludus', 'market', 'training', 'scouting', 'medicus', 'armory', 'pantry',
  'study', 'temple', 'chronicle', 'social', 'relics'
]
where true;
