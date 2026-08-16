-- Progressive-disclosure onboarding: new accounts start seeing only the
-- Ludus Grounds and Slave Market on the map, plus the Pit Fights tab (the
-- only Fights tab that isn't gated). Everything else is revealed as the
-- player reaches the milestone that makes it relevant — see
-- src/lib/discovery.ts for the full trigger table and
-- game.functions.ts for the granting logic.
--
-- Purely cosmetic gating: nothing is functionally locked underneath, a
-- curious click never breaks anything, this only controls what's rendered.
alter table public.profiles
  add column discovered_buildings text[] not null default array[
    'ludus', 'market'
  ];

-- Backfill every existing account to "everything discovered" so nobody
-- who's already playing sees a regression — onboarding is only ever
-- experienced by accounts created after this migration.
update public.profiles
set discovered_buildings = array[
  'ludus', 'market', 'training', 'scouting', 'medicus', 'armory', 'pantry',
  'study', 'temple', 'chronicle', 'social', 'relics',
  'pvp', 'team', 'boss'
]
where true;
