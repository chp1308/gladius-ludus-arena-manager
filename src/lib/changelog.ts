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
    date: "2026-08-22",
    title: "Team Battle rebalance, Cerberus poison, and roster tools",
    items: [
      "Team Battles now genuinely reflect your team's power — a lopsided roster (one strong fighter carried by weak fodder) no longer wins fights it has no business winning.",
      "Leveling up mid-fight always fully heals your gladiator and refunds the charge now — Team Battles, Cursus Honorum, and the World Event could previously level you up without either.",
      "Scouting with a full pantry no longer lets you spam for a free chance at a beast — use the paid \"Roll for a beast\" option once you're full instead.",
      "Cerberus now has a constant, low-level mauling tick like other bosses, and a failed snake-bite dodge poisons your cohort — the next 3 hits taken deal double damage.",
      "Fixed building level/count badges sometimes getting hidden behind a neighboring building on the Ludus map.",
      "The World Event banner now actually takes you to the World Event tab, instead of always landing on Pit Fights.",
      "Pit Fights: the \"pits\" charge counter is now labeled \"battles\", plus a \"Ready to fight\" toggle to hide gladiators with no charges left.",
      "Rival Ludi: a \"Fightable only\" toggle, and more open challenges from rival ludi spread across power levels so there's something to fight at more levels.",
      "The Chronicle Stele now shows up to 200 of your bouts, with an honest count, instead of silently capping at 20 while claiming to show every match.",
      "Ludus Grounds: sort and filter your roster — by level, power, wins, health, name, or weapon style.",
      "Every facility panel now shows what the next level actually unlocks before you spend denarii on it.",
      "New Achievement Leaders leaderboard on the Hall of Champions page.",
      "Leaderboards now show the top 10 by default, with a \"Show 10 more\" button to see the rest.",
      "World Event: press S to strike with whichever fielded champion is off cooldown.",
      "Cursus Honorum: a \"Same crew as last time\" button re-sends the same gladiators without re-picking them.",
      "Cerberus's constant mauling tick was quietly landing as its bare 1-damage floor almost every round regardless of zone — it now actually scales with the fight, hitting roughly 10x harder.",
      "Cerberus's reaction windows are retuned: 3 seconds for a regular beat and 5 seconds for the snake bite, at fully-maxed (100 average) Technique.",
      "Fight result screens now scroll straight to the reward line, fixed for boss fights specifically — a long Cerberus log could previously leave you scrolled to the top.",
    ],
  },
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
