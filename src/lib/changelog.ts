// Player-facing patch notes, shown on /changelog. Newest entry first —
// add a new entry at the top of the array for each release instead of
// editing past ones, so this reads as a history rather than a living doc.
export type ChangelogEntry = {
  date: string; // ISO yyyy-mm-dd
  title: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-08-20",
    title: "Onboarding, combat consistency, and balance",
    items: [
      "New lanistas now get a guided first session — from the Slave Market to your first fight to the Training Yard.",
      "The map now marks any building you haven't visited yet, so nothing gets missed.",
      "Fight recaps scroll straight to your reward instead of making you scroll for it.",
      "The gladiator gear & training menu now shows your denarii purse.",
      "Cerberus got bigger attack art and real teeth — it no longer scales down to match a weak party.",
      "Agility, Stamina, and Technique's training bonuses (healing, injury reduction, fight cooldowns) now require genuinely maxed stats to fully earn, not just whatever the Training Yard's current cap allows.",
      "Max Stamina now cuts Pit/Team Battle cooldowns by 75% (was 50%) — a fully-trained fighter can head back into the arena a lot sooner.",
      "A gladiator's class now always matches how they actually fight — Murmillo, Secutor, and Thraex carry Gladius & Shield, Hoplomachus carries Spear & Shield, Retiarius fights with Net & Trident, and Dimachaerus wields Dual Blades.",
      "Spear & Shield now properly blocks a boss's charge, matching Gladius & Shield — previously only Gladius counted as a shield-bearer.",
      "Net & Trident and Dual Blades no longer get a shield's damage mitigation from their off-hand slot — it now adds extra damage instead, since neither carries a shield.",
    ],
  },
];
