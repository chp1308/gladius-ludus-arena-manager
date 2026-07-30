// BOSS ENCOUNTERS — reflex-driven PvE raids. Unlike pit/team fights (fully
// resolved server-side in one call, then replayed for the client), a boss
// fight advances one telegraphed "beat" at a time: the server rolls whether
// the boss is "vulnerable" or "defensive" this round, the player chooses to
// strike or hold, and the round is scored immediately. All HP pools and
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

export type BossPhase = {
  // Phase HP = teamPower * hpScale.
  hpScale: number;
  // Probability a given round telegraphs "vulnerable" rather than "defensive".
  vulnerableChance: number;
  // Damage to the boss on a correctly-timed strike = teamPower * this.
  vulnerableDamageScale: number;
  // On a "defensive" beat every gladiator must individually choose block
  // (shield-bearers, weapon_type "gladius") or dodge (everyone else). A
  // single wrong or missing answer costs the WHOLE party — this isn't
  // graduated, one gap in the line is enough for the boar through. Damage
  // to the party's pooled HP on any failure = teamMaxHp * this.
  defensiveDamageScale: number;
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

export type BossDefinition = {
  key: string;
  name: string;
  flavor: string;
  // Longer lore blurb for the encounter's fold-out detail card — always
  // shown, unlike the droptable/stats which stay "???" until first kill.
  myth: string;
  size: number;
  phases: BossPhase[];
  lootTable: LootItem[];
  roundDeadlineMs: number;
  maxRoundsPerPhase: number;
  // Shieldwall: if every gladiator sent carries a shield (weapon_type
  // "gladius") and all of them block correctly on a defensive beat, the
  // party doesn't just take zero damage — they counter with a critical
  // strike on the boss instead, at vulnerableDamageScale * this multiplier.
  shieldwallCritMult: number;
  image: string;
  arenaBg: string;
  chargeImage: string;
  howlImage: string;
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
    phases: [
      { name: "The Chase", blurb: "It charges past again and again — mostly about reading its rhythm.",
        hpScale: 0.32, vulnerableChance: 0.6, vulnerableDamageScale: 0.075, defensiveDamageScale: 0.10, tickDamageScale: 0.015 },
      { name: "Cornered and Furious", blurb: "Fewer safe reads, higher stakes both ways — and a chance for a net to snare it outright.",
        hpScale: 0.32, vulnerableChance: 0.5, vulnerableDamageScale: 0.095, defensiveDamageScale: 0.16, tickDamageScale: 0.022, netBonus: true, netBonusDamageScale: 0.12 },
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
];

export function bossRequirementError(
  boss: BossDefinition,
  gladiators: { injury_until: string | null; health: number }[],
  hasWonLocalGames: boolean,
): string | null {
  if (!hasWonLocalGames) return "Win a fight in Local Games first to earn this encounter";
  if (gladiators.length !== boss.size) return `Choose exactly ${boss.size} gladiators`;
  if (gladiators.some(g => g.health < 30)) return "One gladiator is too wounded";
  if (gladiators.some(g => g.injury_until && new Date(g.injury_until) > new Date())) return "One gladiator is injured";
  return null;
}
