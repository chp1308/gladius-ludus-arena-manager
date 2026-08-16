// Shared copy for what each core stat actually does — rendered on the
// Combat Codex (/info) and again under the Training Yard building panel,
// so the explanation lives in one place instead of drifting between two
// hand-written copies.
export type StatInfo = {
  key: "strength" | "agility" | "stamina" | "technique";
  label: string;
  blurb: string;
  bonuses: { label: string; value: string }[];
};

export const STAT_INFO: StatInfo[] = [
  {
    key: "strength",
    label: "Strength",
    blurb: "Raw muscle — the backbone of every heavy hitter, and the only stat that sets a gladiator's max health.",
    bonuses: [
      { label: "Power", value: "weighted by weapon style — heaviest for Gladius & Shield" },
      { label: "Max Health", value: "+5 HP per point" },
    ],
  },
  {
    key: "agility",
    label: "Agility",
    blurb: "Speed, reflexes, and footwork — the difference between a clean dodge and a bad wound.",
    bonuses: [
      { label: "Power", value: "weighted by weapon style — heaviest for Dual Blades" },
      { label: "Passive healing", value: "up to +30% faster HP regen (scales toward the Training Yard's stat cap)" },
      { label: "Injury recovery", value: "up to 30% shorter injury time (same scaling)" },
    ],
  },
  {
    key: "stamina",
    label: "Stamina",
    blurb: "Endurance and grit — how many hard fights a gladiator can shrug off before needing rest.",
    bonuses: [
      { label: "Power", value: "weighted by weapon style — heaviest for Gladius & Shield" },
      { label: "Pit & Team Battle charges", value: "up to 50% shorter cooldown between fights (scales toward the Training Yard's stat cap)" },
    ],
  },
  {
    key: "technique",
    label: "Technique",
    blurb: "Skill of arms — precision and timing over brute force.",
    bonuses: [
      { label: "Power", value: "weighted by weapon style — heaviest for Spear & Net and Trident" },
      { label: "Injury risk", value: "up to 75% less likely to be injured on a qualifying hit, in every fight type (scales toward the Training Yard's stat cap)" },
      { label: "Boss fight reaction time", value: "up to 2x longer to block/dodge/strike, based on the party's average technique out of a fixed 100 — not the Training Yard's stat cap, so this one takes genuinely maxed-out technique to fully earn" },
    ],
  },
];

// Agility/Stamina/Technique's secondary bonuses scale relative to the
// Training Yard's stat cap (15 + Training Yard level × 10), not a fixed
// number — so upgrading the Training Yard both raises the cap and quietly
// strengthens what every point already trained in those stats is worth.
// The one exception is Technique's boss-fight reaction-time bonus, which
// deliberately scales against a fixed 100 instead — see bossDeadlineMult
// in game.functions.ts for why.
export const STAT_SCALING_NOTE =
  "Agility, Stamina, and Technique's injury-risk bonus above scale toward the Training Yard's stat cap, not a fixed number — upgrading the Training Yard raises that cap, which makes every point already trained in those stats worth more. Technique's boss-fight reaction bonus is the exception: it always scales toward a fixed 100.";
