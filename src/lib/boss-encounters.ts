// BOSS ENCOUNTERS — reflex-driven PvE raids. Unlike pit/team fights (fully
// resolved server-side in one call, then replayed for the client), a boss
// fight advances one telegraphed "beat" at a time in a fixed, learnable
// rhythm — strike window, boar attack, strike window, boar special (howl)
// attack, repeat (see bossBeatForRound in game.functions.ts) — rather than
// rolling an independent random beat every round, which let players just
// mash Strike whenever the label happened to say so. All HP pools and
// damage numbers are fractions of the sent party's own power/health rather
// than fixed constants, so the same boss scales to whatever party is sent —
// the fight's difficulty is a function of the roster you commit, not a
// fixed-level check at the door. Unlocked by winning a Local Games pit
// fight, not by a fame threshold — see hasWonLocal in getBossFightState.
import boarSelectImg from "@/assets/bosses/boar-select.png";
import boarArenaBgImg from "@/assets/bosses/boar-start.png";
import boarChargeImg from "@/assets/bosses/boar-charge.png";
import boarHowlImg from "@/assets/bosses/boar-howl.png";
import boarDefeatedImg from "@/assets/bosses/boar-defeated.png";
import boarWinImg from "@/assets/bosses/boar-win.png";
import cerberusSelectImg from "@/assets/bosses/cerberus_1_select.png";
import cerberusArenaBgImg from "@/assets/bosses/cerberus_1_start.png";
import cerberusLeftMiddleImg from "@/assets/bosses/cerberus_left_middle_lunge.png";
import cerberusRightMiddleImg from "@/assets/bosses/cerberus_right_middle_lunge.png";
import cerberusMiddleOnlyImg from "@/assets/bosses/cerberus_middle_only_lunge.png";
import cerberusLeftRightImg from "@/assets/bosses/cerberus_lunge_right_left.png";
import cerberusAllThreeImg from "@/assets/bosses/cerberus_all_three_lunge.png";
import cerberusSnakeAttackImg from "@/assets/bosses/cerberus_snake_attack.png";
import cerberusDefeatedImg from "@/assets/bosses/cerberus_defeated.png";
import cerberusWonImg from "@/assets/bosses/cerberus_won.png";

export type BossPhase = {
  // Phase HP = teamPower * hpScale.
  hpScale: number;
  // Unused by the fixed 4-beat rotation itself (see bossBeatForRound) —
  // kept only for the one-off net_bonus override at a phase's first round.
  vulnerableChance: number;
  // Damage to the boss on a correctly-timed strike = teamPower * this.
  vulnerableDamageScale: number;
  // On a "defensive" beat (the boar's regular attack) every gladiator must
  // individually choose block (shield-bearers, weapon_type "gladius") or
  // dodge (everyone else). A single wrong or missing answer costs the WHOLE
  // party — this isn't graduated, one gap in the line is enough for the
  // boar through. Damage to the party's pooled HP on any failure =
  // teamMaxHp * this.
  defensiveDamageScale: number;
  // The boar's special "howl" attack — same block/dodge call as the regular
  // attack above, but harsher: a shorter reaction window (see
  // HOWL_DEADLINE_MULT in game.functions.ts) and more damage to the party's
  // pooled HP on any failure = teamMaxHp * this.
  howlDamageScale: number;
  // The boar also keeps mauling passively, every second, regardless of the
  // round's outcome — teamMaxHp * this per second, reduced (never below 1)
  // by the party's frozen average armor mitigation. Rewards fast decisions
  // and real armor investment independent of the reflex mechanic.
  tickDamageScale: number;
  // If true, and the party includes a net-and-trident (weapon_type "net")
  // gladiator, the phase's first round is a guaranteed bonus beat instead of
  // a random roll: striking it is risk-free and deals teamPower * this.
  netBonus?: boolean;
  netBonusDamageScale?: number;
  // Display name for the bestiary reveal (e.g. "The Chase") — only shown
  // once the boss has been defeated at least once.
  name: string;
  blurb: string;
};

// Cerberus doesn't use the boar's fixed 4-beat rotation (see mechanic
// below). Its BossPhase entries are reused as three HP-fraction "zones" of
// one continuous health bar instead of three separate reset-on-transition
// pools: defensiveDamageScale doubles as the head-lunge miss penalty,
// howlDamageScale as the snake-bite miss penalty, vulnerableDamageScale as
// the strike-window payoff — see cerberusZoneIndex/rollCerberusBurstLength
// in game.functions.ts. tickDamageScale and netBonus are unused (Cerberus
// has no passive mauling and no net-bonus beat).
export type DogLungeVariant = "left_middle" | "right_middle" | "middle_only" | "left_right" | "all_three";

// One row of the boss's loot table. "denarii" rolls a random amount in
// [min, max] and is granted automatically every win (chance 1) — still
// modeled as a table row so the UI has one shared format. "gear" is rolled
// once per gladiator sent (see finish() in game.functions.ts), so its
// chance is "per gladiator," and a single fight can record it more than
// once in loot_drops. "trinket" grants a permanent account-wide relic (see
// relics.ts) — unique, the roll is skipped once the ludus already owns it.
export type LootItem =
  | { key: string; label: string; chance: number; effect: "denarii"; min: number; max: number }
  | { key: string; label: string; chance: number; effect: "gear" }
  | { key: string; label: string; chance: number; effect: "trinket"; relicKey: string };

// What unlocks an encounter — checked in bossRequirementError below.
// "local_games" mirrors the original single-boss gate (win a Local Games
// pit fight); "defeat_boss" requires a prior win over a named earlier boss,
// for encounters meant to come after it.
export type BossUnlock =
  | { type: "local_games" }
  | { type: "defeat_boss"; bossKey: string; label: string };

export type BossDefinition = {
  key: string;
  name: string;
  flavor: string;
  // Longer lore blurb for the encounter's fold-out detail card — always
  // shown, unlike the droptable/stats which stay "???" until first kill.
  myth: string;
  size: number;
  // "boar": the fixed vulnerable/defensive/vulnerable/howl rotation, phases
  // are separate HP pools that reset on transition (bossBeatForRound).
  // "cerberus": one continuous HP bar; phases are reused as attack-intensity
  // zones keyed by remaining HP fraction (cerberusZoneIndex), each round is
  // one attack in a variable-length burst before a single strike window.
  mechanic: "boar" | "cerberus";
  unlock: BossUnlock;
  phases: BossPhase[];
  lootTable: LootItem[];
  roundDeadlineMs: number;
  maxRoundsPerPhase: number;
  // Shieldwall: if every gladiator sent carries a shield (weapon_type
  // "gladius") and all of them block correctly on a defensive/snake-bite
  // beat, the party doesn't just take zero damage — they counter with a
  // critical strike on the boss instead, at vulnerableDamageScale * this.
  shieldwallCritMult: number;
  image: string;
  arenaBg: string;
  chargeImage: string;
  howlImage: string;
  // Cerberus only — one pose per head-lunge pattern, and the snake-bite pose.
  dogLungeImages?: Record<DogLungeVariant, string>;
  snakeAttackImage?: string;
  // Shown full-screen on the result dialog — defeatedImage on a win (the
  // beast felled), lossImage on a loss (the beast triumphant).
  defeatedImage: string;
  lossImage: string;
};

export const BOSS_ENCOUNTERS: BossDefinition[] = [
  {
    key: "erymanthian_boar",
    name: "The Erymanthian Boar",
    flavor: "A tusked terror driven from the mountain — Hercules himself once netted it in the snow.",
    myth: "The fourth labor of Hercules: a monstrous boar that terrorized the slopes of Mount Erymanthos, goring farms and travelers alike. Hercules ran it down through the deep snow until it exhausted itself, then bound it in nets and dragged it back to Mycenae alive — a feat no lesser hunter dared attempt.",
    size: 3,
    mechanic: "boar",
    unlock: { type: "local_games" },
    phases: [
      { name: "The Chase", blurb: "It charges past again and again — mostly about reading its rhythm, with the odd bellow to punish a slow line.",
        hpScale: 0.32, vulnerableChance: 0.6, vulnerableDamageScale: 0.075, defensiveDamageScale: 0.10, howlDamageScale: 0.17, tickDamageScale: 0.015 },
      { name: "Cornered and Furious", blurb: "Fewer safe reads, higher stakes both ways, a fiercer howl — and a chance for a net to snare it outright.",
        hpScale: 0.32, vulnerableChance: 0.5, vulnerableDamageScale: 0.095, defensiveDamageScale: 0.16, howlDamageScale: 0.27, tickDamageScale: 0.022, netBonus: true, netBonusDamageScale: 0.12 },
    ],
    lootTable: [
      { key: "denarii", label: "Denarii Purse", chance: 1, effect: "denarii", min: 200, max: 400 },
      { key: "gear", label: "Gear Upgrade (per gladiator)", chance: 0.25, effect: "gear" },
      { key: "gold_trinket", label: "Tusk of the Great Boar", chance: 0.1, effect: "trinket", relicKey: "gold_trinket" },
    ],
    roundDeadlineMs: 2000,
    maxRoundsPerPhase: 30,
    shieldwallCritMult: 1.5,
    image: boarSelectImg,
    arenaBg: boarArenaBgImg,
    chargeImage: boarChargeImg,
    howlImage: boarHowlImg,
    defeatedImage: boarDefeatedImg,
    lossImage: boarWinImg,
  },
  {
    key: "cerberus",
    name: "Cerberus, Hound of Hades",
    flavor: "The three-headed hound of the underworld — chained at the gates of Hades, and still hungry.",
    myth: "The final labor demanded of Heracles: descend into the underworld and drag Cerberus, guardian of its gates, into the daylight — bare-handed, no chains, no blades. Hades allowed it on that condition alone. Heracles wrestled the hound into submission by strength and will, hauled it before Eurystheus, then returned it to its post before it could take a bite out of the throne room.",
    size: 3,
    mechanic: "cerberus",
    unlock: { type: "defeat_boss", bossKey: "erymanthian_boar", label: "Defeat the Erymanthian Boar first" },
    // Reused as three attack-intensity zones of one continuous HP bar, not
    // three separate pools — see the mechanic comment on BossDefinition.
    // hpScale is only read from phases[0], at fight start.
    phases: [
      { name: "Three Heads Hunting", blurb: "All three heads circle and lunge in pairs — read the gap and step through it. Two attacks before it gives you an opening.",
        hpScale: 0.95, vulnerableChance: 1, vulnerableDamageScale: 0.11, defensiveDamageScale: 0.09, howlDamageScale: 0.14, tickDamageScale: 0 },
      { name: "Backed to the Gate", blurb: "Fewer safe reads and faster onslaughts — three or four attacks now, before it gives ground.",
        hpScale: 0, vulnerableChance: 1, vulnerableDamageScale: 0.11, defensiveDamageScale: 0.13, howlDamageScale: 0.20, tickDamageScale: 0 },
      { name: "Last Guardian of Hell", blurb: "Wounded and desperate, it keeps coming — three attacks at minimum, and it may not stop there.",
        hpScale: 0, vulnerableChance: 1, vulnerableDamageScale: 0.11, defensiveDamageScale: 0.18, howlDamageScale: 0.27, tickDamageScale: 0 },
    ],
    lootTable: [
      { key: "denarii", label: "Denarii Purse", chance: 1, effect: "denarii", min: 500, max: 900 },
      { key: "gear", label: "Gear Upgrade (per gladiator)", chance: 0.35, effect: "gear" },
    ],
    roundDeadlineMs: 2400,
    maxRoundsPerPhase: 90,
    shieldwallCritMult: 1.5,
    image: cerberusSelectImg,
    arenaBg: cerberusArenaBgImg,
    chargeImage: cerberusAllThreeImg,
    howlImage: cerberusSnakeAttackImg,
    dogLungeImages: {
      left_middle: cerberusLeftMiddleImg,
      right_middle: cerberusRightMiddleImg,
      middle_only: cerberusMiddleOnlyImg,
      left_right: cerberusLeftRightImg,
      all_three: cerberusAllThreeImg,
    },
    snakeAttackImage: cerberusSnakeAttackImg,
    defeatedImage: cerberusDefeatedImg,
    lossImage: cerberusWonImg,
  },
];

export function bossRequirementError(
  boss: BossDefinition,
  gladiators: { injury_until: string | null; health: number }[],
  unlockState: { hasWonLocalGames: boolean; defeatedBossKeys: Set<string> },
): string | null {
  if (boss.unlock.type === "local_games") {
    if (!unlockState.hasWonLocalGames) return "Win a fight in Local Games first to earn this encounter";
  } else if (!unlockState.defeatedBossKeys.has(boss.unlock.bossKey)) {
    return boss.unlock.label;
  }
  if (gladiators.length !== boss.size) return `Choose exactly ${boss.size} gladiators`;
  if (gladiators.some(g => g.health < 30)) return "One gladiator is too wounded";
  if (gladiators.some(g => g.injury_until && new Date(g.injury_until) > new Date())) return "One gladiator is injured";
  return null;
}
