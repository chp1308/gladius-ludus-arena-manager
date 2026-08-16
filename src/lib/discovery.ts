// Progressive-disclosure onboarding: profiles.discovered_buildings gates
// what a new account sees on the Ludus map and which Fights tabs render.
// Purely cosmetic — nothing underneath is functionally locked, so a curious
// direct link or stale UI state never breaks anything. New accounts start
// with just the map/market; every other key here is granted one-time and
// idempotently by an action handler in game.functions.ts (see grantsFor
// below for exactly which action grants which keys). Existing accounts are
// backfilled to the full list by the migration, so this only ever affects
// accounts created after it.
// Ordered to match the natural unlock progression (see DISCOVERY_MILESTONE
// below) so a checklist built by walking this array in order needs no
// separate sort — earliest-reachable milestones come first.
export const DISCOVERY_KEYS = [
  "ludus", "market",
  "training", "social",
  "scouting",
  "medicus", "chronicle", "pvp", "armory",
  "pantry", "team", "study",
  "relics", "boss",
  "temple",
] as const;
export type DiscoveryKey = (typeof DISCOVERY_KEYS)[number];

export const DEFAULT_DISCOVERED: DiscoveryKey[] = ["ludus", "market"];

// One-line flavor shown the first time a newly-discovered building's dialog
// opens (see the client's "seenIntro" tracking) — in the game's own voice,
// not generic UI copy.
export const DISCOVERY_INTRO: Partial<Record<DiscoveryKey, string>> = {
  training: "A yard of packed sand and worn practice posts — your gladiators will bleed sweat here before they ever bleed for coin.",
  social: "Rome's high society keeps its own arena. A well-placed gift can win more than any pit fight.",
  scouting: "Send word to the provinces — better scouts find better blood, and sometimes something with claws.",
  medicus: "The physician's tent. What the sand takes, coin and time give back.",
  chronicle: "Every bout, carved in stone, so none of it is forgotten.",
  pvp: "Other lanistas have heard your name. Now they want to test it.",
  armory: "The forge fires never go cold. Bring denarii, leave with steel.",
  pantry: "More mouths to feed means more room to grow your ludus.",
  team: "Some fights aren't won alone. Field a cohort, not just a champion.",
  study: "Discipline turns raw talent into a fighting style worth fearing.",
  relics: "Whispers of mythic beasts and the trinkets torn from them.",
  boss: "You've proven yourself in Local Games. Now Rome offers you something worse than a rival.",
  temple: "Every gladiator's name belongs somewhere, win or lose, living or fallen.",
};

// Human labels for the getting-started checklist — what the player is being
// told to go DO, not just what unlocks (that's DISCOVERY_INTRO's job).
export const DISCOVERY_MILESTONE: Partial<Record<DiscoveryKey, string>> = {
  training: "Recruit your first gladiator",
  social: "Recruit your first gladiator",
  scouting: "Train a stat",
  medicus: "Fight in the Pits",
  chronicle: "Fight in the Pits",
  pvp: "Fight in the Pits",
  armory: "Fight in the Pits",
  pantry: "Recruit a second gladiator",
  team: "Recruit a second gladiator",
  study: "Recruit a second gladiator",
  relics: "Win a fight in Local Games",
  boss: "Win a fight in Local Games",
  temple: "Fight your first Rival Ludus battle",
};

export function withNewDiscoveries(
  current: string[] | null | undefined,
  keys: DiscoveryKey[],
): string[] | null {
  const set = new Set(current ?? []);
  let changed = false;
  for (const k of keys) {
    if (!set.has(k)) { set.add(k); changed = true; }
  }
  return changed ? [...set] : null;
}
