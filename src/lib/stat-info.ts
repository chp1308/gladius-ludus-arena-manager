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
      { label: "Passive healing", value: "up to +30% faster HP regen (scales toward 100 Agility)" },
      { label: "Injury recovery", value: "up to 30% shorter injury time (same scaling)" },
    ],
  },
  {
    key: "stamina",
    label: "Stamina",
    blurb: "Endurance and grit — how many hard fights a gladiator can shrug off before needing rest.",
    bonuses: [
      { label: "Power", value: "weighted by weapon style — heaviest for Gladius & Shield" },
      { label: "Pit & Team Battle charges", value: "up to 50% shorter cooldown between fights (scales toward 100 Stamina)" },
    ],
  },
  {
    key: "technique",
    label: "Technique",
    blurb: "Skill of arms — precision and timing over brute force.",
    bonuses: [
      { label: "Power", value: "weighted by weapon style — heaviest for Spear & Net and Trident" },
      { label: "Injury risk", value: "up to 75% less likely to be injured on a qualifying hit, in every fight type (scales toward 100 Technique)" },
      { label: "Boss fight reaction time", value: "up to 2x longer to block/dodge/strike, based on the party's average Technique (same scaling)" },
    ],
  },
];

// Agility/Stamina/Technique's secondary bonuses all scale toward a fixed
// 100 in the stat — not the Training Yard's current cap, which only
// controls how high a stat can be TRAINED, not how much of the bonus a
// given point is worth. Reaching the full bonus early (e.g. training
// Agility to a lvl-1 Training Yard's cap of 25) used to award the whole
// +30%; now it genuinely takes 100 in the stat, so upgrading the Training
// Yard is worth it for more than just cheaper/bigger stat gains.
export const STAT_SCALING_NOTE =
  "Agility, Stamina, and Technique's bonuses above all scale toward 100 in the stat, not the Training Yard's current cap — the Training Yard only controls how high a stat can be trained, so reaching these bonuses in full takes genuinely maxed-out stats, however long that takes.";
