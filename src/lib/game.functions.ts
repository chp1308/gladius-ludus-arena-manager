import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import backwaterImg from "@/assets/arena/arena-backwater-pits.jpg";
import waysideImg from "@/assets/arena/arena-wayside-arena.jpg";
import localImg from "@/assets/arena/arena-local-games.jpg";
import provincialImg from "@/assets/arena/arena-provincial-munera.jpg";
import capuaImg from "@/assets/arena/arena-grand-capua.jpg";
import colosseumImg from "@/assets/arena/arena-colosseum.jpg";
import emperorImg from "@/assets/arena/arena-emperor-spectacle.jpg";
import { SOCIAL_EVENTS, type SocialEvent, type SocialTone } from "@/lib/social-events";
import { BOSS_ENCOUNTERS, bossRequirementError, type LootItem, type BossDefinition, type DogLungeVariant } from "@/lib/boss-encounters";
import { RELICS, applyGoldBonus } from "@/lib/relics";

// Structured per-round combat data for animated battle replays on the
// client. `text` mirrors the exact line pushed into the fight's `log` for
// that round, so the client can locate round boundaries within the full log
// (for intro/outro lines) without duplicating narrative-construction logic.
export type FightRound = {
  attacker: "me" | "opponent";
  damage: number;
  myHp: number;
  oppHp: number;
  text: string;
};

// Debits denarii via the atomic spend_denarii RPC. Throws the real database
// error when the call itself fails (missing function, permission issue,
// etc.) instead of always reporting "insufficient funds" — a prior version
// discarded the RPC error and made every failure mode look like the player
// couldn't afford it.
async function spendDenarii(
  admin: SupabaseClient<Database>,
  userId: string,
  amount: number,
  insufficientFundsMessage: string,
) {
  const { data, error } = await admin.rpc("spend_denarii", { p_user: userId, p_amount: amount });
  if (error) throw new Error(error.message);
  if (data == null) throw new Error(insufficientFundsMessage);
}

const ORIGINS = ["Thrace", "Gaul", "Nubia", "Britannia", "Germania", "Hispania", "Syria", "Numidia"];
const CLASSES = ["Murmillo", "Retiarius", "Thraex", "Secutor", "Hoplomachus", "Dimachaerus"];
const PRAENOMEN = ["Marcus", "Quintus", "Lucius", "Titus", "Gaius", "Aulus", "Decimus", "Publius", "Spurius", "Crixus", "Priscus", "Verus", "Flamma", "Spartacus", "Hermes", "Tetraites"];
const COGNOMEN = ["the Bull", "the Wolf", "the Swift", "the Iron", "of Capua", "the Younger", "Ferrus", "Magnus", "the Silent", "the Grim", "the Fair", "Invictus", ""];

// Human weapon styles — like Domina's fighting styles
const WEAPON_TYPES = ["gladius", "spear", "net", "dual"] as const;
type WeaponType = typeof WEAPON_TYPES[number] | "beast_lion" | "beast_tiger" | "beast_elephant" | "beast_rhino";

export const WEAPON_LABELS: Record<string, string> = {
  gladius: "Gladius & Shield",
  spear: "Spear",
  net: "Net & Trident",
  dual: "Dual Blades",
  beast_lion: "Lion",
  beast_tiger: "Tiger",
  beast_elephant: "War Elephant",
  beast_rhino: "Armored Rhino",
};


// Facility caps and effects
const MAX_FACILITY = 5;
const MAX_SKILL = 5;
export const MAX_GEAR_TIER = 8;
const FACILITY_COST = (curr: number) => 500 * (curr + 1); // 1->2 costs 1000
const SKILL_COST = (curr: number) => 200 * (curr + 1);

// Training Yard alone goes past the shared facility cap — extra levels let
// stats reach a hard 100 cap. Cost per step also steepens above level 5
// (+1000/step instead of the shared +500/step), continuous at the level-5
// boundary (curr=4 gives 2500 under both formulas).
export const TRAINING_MAX_LEVEL = 10;
export const trainingFacilityCost = (curr: number) =>
  curr < 5 ? FACILITY_COST(curr) : 2500 + 1000 * (curr - 4);

// Temple of Relics — governs the odds of "key" loot drops (e.g. Key to
// Hades). Denominator shrinks by 5 per level: 1/25, 1/20, 1/15, 1/10, 1/5.
export const keyDropChance = (relicsLevel: number) => 1 / (30 - 5 * relicsLevel);

// Armory level required to CRAFT gear of a given tier.
// Basic gear needs a village smith; masterwork needs the Master Forge.
const ARMORY_REQ_FOR_TIER = [0, 1, 1, 2, 2, 3, 3, 4, 5];
export function requiredArmoryLevel(tier: number): number {
  const t = Math.max(1, Math.min(MAX_GEAR_TIER, tier));
  return ARMORY_REQ_FOR_TIER[t] ?? 5;
}
// Highest gear tier craftable at a given Forge (armory) level.
export function maxCraftableTier(armoryLevel: number): number {
  let max = 0;
  for (let t = 1; t <= MAX_GEAR_TIER; t++) {
    if (requiredArmoryLevel(t) <= armoryLevel) max = t;
  }
  return max;
}

// Stat cap grows with training facility (+10 per level through 5, then a
// shallower +7/level from 6-10 so it lands exactly on 100 at the new max).
export const statCap = (trainingLevel: number) =>
  trainingLevel <= 5 ? 15 + trainingLevel * 10 : 65 + (trainingLevel - 5) * 7; // lvl1=25, lvl5=65, lvl10=100
// Max health scales with strength: +5 HP per point
export const maxHealth = (strength: number) => 100 + strength * 5;
// Training cost falls with training facility level — rescaled to span all
// 10 levels (was 50 -> 26 over levels 1-5, floored at 20); now spans
// 50 -> 20 over levels 1-10, landing exactly on the 20-denarii floor at max.
export const trainCost = (trainingLevel: number) => Math.max(20, Math.round(50 - (trainingLevel - 1) * (10 / 3)));
// Chance a training session grants +2 instead of +1 — rescaled to span all
// 10 levels (was 5%->30% over levels 1-5); now the same 5 values step every
// other level, still topping out at 30% at the new max level.
const TRAIN_BIG_CHANCE: Record<number, number> = {
  1: 0.05, 2: 0.05, 3: 0.10, 4: 0.10, 5: 0.15,
  6: 0.15, 7: 0.20, 8: 0.20, 9: 0.30, 10: 0.30,
};
export const trainBigChance = (trainingLevel: number) => TRAIN_BIG_CHANCE[trainingLevel] ?? 0;
// Recruiting cost falls with the Scouting Network level
export const recruitCost = (scoutingLevel: number) => Math.max(60, 100 - (scoutingLevel - 1) * 10);
// Chance a scouted recruit is a beast
export const beastChance = (scoutingLevel: number) => Math.min(0.02 + scoutingLevel * 0.03, 0.2);
// Gear upgrade cost by slot, tier, and armory level
const SLOT_COST_MULT: Record<string, number> = {
  weapon: 1.0, armor: 0.85, helmet: 0.55, legs: 0.55, offhand: 0.7,
};
export const gearCost = (slot: "weapon" | "armor" | "helmet" | "legs" | "offhand", currentTier: number, armoryLevel: number) => {
  const base = 150 * (currentTier + 1) * (SLOT_COST_MULT[slot] ?? 1);
  return Math.max(40, Math.floor(base * (1 - (armoryLevel - 1) * 0.1)));
};
// Healing cost falls with the Valetudinarium (medicus) facility level
// Weak/new gladiators are capped so a full heal never costs more than 100
// denarii at level 1 — the ceiling rises gradually as they level up.
export const healCostCap = (level: number) => 100 + Math.max(0, level - 1) * 20;
export const healCost = (missingHealth: number, medicusLevel: number, level: number = 1) => {
  const baseCost = Math.max(30, missingHealth * 2);
  const discounted = Math.max(15, Math.floor(baseCost * (1 - (medicusLevel - 1) * 0.12)));
  return Math.min(discounted, healCostCap(level));
};

// ---------- PASSIVE HEALING ----------
// Time-based healing (both passive HP regen and injury-day cooldowns) share
// this reduction: Valetudinarium levels give a flat table (big jump at max
// level, matching the achievement-badge tier shape), and Agility adds up to
// +30% more, scaled relative to the *current* stat cap rather than a flat
// per-point bonus — a flat rate would blow past 100% reduction if the stat
// cap is ever raised later (same reasoning as the pit-fight cooldown).
const MEDICUS_HEAL_SPEED_PCT: Record<number, number> = { 1: 0.05, 2: 0.10, 3: 0.15, 4: 0.20, 5: 0.50 };
const AGILITY_HEAL_BONUS_MAX = 0.30;
// The Valetudinarium's own contribution to heal-speed/injury-duration
// reduction, before any per-gladiator Agility bonus is added on top.
export const medicusSpeedPct = (medicusLevel: number) => MEDICUS_HEAL_SPEED_PCT[medicusLevel] ?? 0;
export function healSpeedReduction(agility: number, medicusLevel: number, trainingLevel: number): number {
  const medicusPct = MEDICUS_HEAL_SPEED_PCT[medicusLevel] ?? 0;
  const cap = statCap(trainingLevel);
  const agilityPct = cap > 0 ? AGILITY_HEAL_BONUS_MAX * Math.min(1, agility / cap) : 0;
  return Math.min(0.9, medicusPct + agilityPct);
}

// Base rate: a fully-wounded gladiator (100 missing HP) heals in 8 hours
// with no bonuses.
const BASE_HEAL_HOURS_PER_100HP = 8;
export function healRegenPerHour(agility: number, medicusLevel: number, trainingLevel: number): number {
  const hoursFor100 = BASE_HEAL_HOURS_PER_100HP * (1 - healSpeedReduction(agility, medicusLevel, trainingLevel));
  return 100 / hoursFor100;
}

// Derives current health from the stored value plus regen accrued since
// health_updated_at — computed lazily on read, never ticked by a cron. The
// next action that actually changes health persists the settled result.
export function effectiveHealth(
  g: { health: number; strength: number; agility: number; health_updated_at: string },
  medicusLevel: number,
  trainingLevel: number,
): number {
  const hpMax = maxHealth(g.strength);
  if (g.health >= hpMax) return hpMax;
  const elapsedHours = (Date.now() - new Date(g.health_updated_at).getTime()) / 3_600_000;
  // health_updated_at can be missing before the migration adding it has run
  // against a given database — treat that as "no regen accrued" rather than
  // propagating NaN into the gladiator's health.
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) return g.health;
  const rate = healRegenPerHour(g.agility, medicusLevel, trainingLevel);
  return Math.min(hpMax, Math.round(g.health + elapsedHours * rate));
}

// Injury cooldowns (capped at 24h — a full day is the worst case) reduce by
// the same time-scaling as passive regen.
export function injuryHours(baseHours: number, agility: number, medicusLevel: number, trainingLevel: number): number {
  const reduction = healSpeedReduction(agility, medicusLevel, trainingLevel);
  return Math.max(1, Math.round(baseHours * (1 - reduction)));
}

// Pit-fight injury chance: a flat 10% baseline at full health, climbing to
// a 60% ceiling the more wounded the gladiator was going into the fight —
// fighting hurt is what risks an injury, not how rough any one bout was.
export function pitInjuryChance(startHealthPct: number): number {
  return Math.min(0.6, 0.1 + 0.5 * (1 - Math.max(0, Math.min(1, startHealthPct))));
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function generateGladiator(scoutingLevel: number) {
  // Better scouting = better base stats + chance of beast
  if (Math.random() < beastChance(scoutingLevel)) {
    // Weighted species roll: lion 40%, tiger 30%, rhino 20%, elephant 10%.
    const r = Math.random();
    const species: "lion" | "tiger" | "rhino" | "elephant" =
      r < 0.40 ? "lion" : r < 0.70 ? "tiger" : r < 0.90 ? "rhino" : "elephant";
    const profiles = {
      lion:     { name: "Roaring Lion",   origin: "Numidia",  wt: "beast_lion" as const,     s: rand(9, 14),  a: rand(6, 10),  st: rand(7, 11),  t: rand(1, 3) },
      tiger:    { name: "Prowling Tiger", origin: "India",    wt: "beast_tiger" as const,    s: rand(8, 12),  a: rand(9, 14),  st: rand(7, 11),  t: rand(1, 3) },
      rhino:    { name: "Armored Rhino",  origin: "Aethiopia",wt: "beast_rhino" as const,    s: rand(12, 16), a: rand(3, 6),   st: rand(11, 15), t: rand(1, 2) },
      elephant: { name: "War Elephant",   origin: "Mauretania",wt:"beast_elephant" as const, s: rand(13, 18), a: rand(2, 5),   st: rand(13, 18), t: rand(1, 2) },
    };
    const p = profiles[species];
    return {
      name: p.name, origin: p.origin, class: "Beast", weapon_type: p.wt,
      is_beast: true, strength: p.s, agility: p.a, stamina: p.st, technique: p.t,
    };
  }

  const bonus = Math.floor((scoutingLevel - 1) * 0.8);
  const name = `${pick(PRAENOMEN)}${Math.random() < 0.5 ? " " + pick(COGNOMEN) : ""}`.trim();
  return {
    name,
    origin: pick(ORIGINS),
    class: pick(CLASSES),
    weapon_type: pick(WEAPON_TYPES as unknown as string[]),
    is_beast: false,
    strength: rand(4, 9) + bonus,
    agility: rand(4, 9) + bonus,
    stamina: rand(4, 9) + bonus,
    technique: rand(3, 8) + bonus,
  };
}

// Per-weapon-type stat weights. Each set sums to 12, matching the old flat
// `3 * (STR+AGI+STA+TEC)`; classes differ only in which stats matter most.
// gladius: shield brawler, favors strength & endurance.
// spear:   long reach, disciplined technique.
// net:     tricky retiarius, agility & technique.
// dual:    dimachaerus footwork, agility above all.
// beasts:  raw predator, strength & agility, no technique.
export const STAT_WEIGHTS: Record<string, { strength: number; agility: number; stamina: number; technique: number }> = {
  gladius:     { strength: 4, agility: 2, stamina: 4, technique: 2 },
  spear:       { strength: 2, agility: 3, stamina: 3, technique: 4 },
  net:         { strength: 2, agility: 4, stamina: 2, technique: 4 },
  dual:        { strength: 3, agility: 5, stamina: 2, technique: 2 },
  beast_lion:     { strength: 5, agility: 3, stamina: 3, technique: 1 },
  beast_tiger:    { strength: 3, agility: 5, stamina: 3, technique: 1 },
  beast_elephant: { strength: 5, agility: 1, stamina: 5, technique: 1 },
  beast_rhino:    { strength: 6, agility: 2, stamina: 4, technique: 0 },
};

const DEFAULT_WEIGHTS = { strength: 3, agility: 3, stamina: 3, technique: 3 };

export function gladiatorPower(
  g: {
    strength: number; agility: number; stamina: number; technique: number;
    level: number; weapon_tier: number; armor_tier: number;
    helmet_tier?: number; legs_tier?: number; offhand_tier?: number;
    health: number;
    weapon_type: string;
  },
  skillLevel: number,
) {
  const w = STAT_WEIGHTS[g.weapon_type] ?? DEFAULT_WEIGHTS;
  const base = w.strength * g.strength + w.agility * g.agility + w.stamina * g.stamina + w.technique * g.technique;
  const gear =
    g.weapon_tier * 12 + g.armor_tier * 9 +
    (g.helmet_tier ?? 1) * 4 + (g.legs_tier ?? 1) * 4 + (g.offhand_tier ?? 1) * 5;
  // Level: small flat bonus + modest multiplicative per level.
  const lvl = g.level * 6;
  const levelMult = 1 + (g.level - 1) * 0.02;
  const healthMod = g.health / maxHealth(g.strength);
  const raw = (base + gear + lvl) * healthMod * levelMult;
  const skillMod = 1 + skillLevel * 0.08; // +8% per skill level for the matching style
  return Math.floor(raw * skillMod);
}

// Probability that fighter A wins an exchange against fighter B.
// 5% minimum upset chance, 90% scaled by the 0.75-power ratio, 95% maximum.
export function winChance(powerA: number, powerB: number): number {
  const a = Math.max(0, powerA);
  const b = Math.max(0, powerB);
  if (a === 0 && b === 0) return 0.5;
  const ratio = Math.pow(a, 0.75) / (Math.pow(a, 0.75) + Math.pow(b, 0.75));
  return 0.05 + 0.90 * ratio;
}

// Weapon tier increases hit range. Tier 1: 15–30, Tier 8: 36–65.
export function weaponDamageRange(weaponTier: number) {
  const t = Math.max(1, weaponTier || 1);
  return { min: 15 + (t - 1) * 3, max: 30 + (t - 1) * 5 };
}

// Armor tiers reduce incoming damage. Averages helmet/cuirass/greaves/offhand.
export function armorMitigation(g: {
  armor_tier?: number | null; helmet_tier?: number | null;
  legs_tier?: number | null; offhand_tier?: number | null;
}, defenseLevel: number = 0) {
  const a = g.armor_tier ?? 1, h = g.helmet_tier ?? 1;
  const l = g.legs_tier ?? 1, o = g.offhand_tier ?? 1;
  // Cuirass weighted highest; offhand (shield) contributes if worn.
  const score = a * 1.5 + h * 1.0 + l * 1.0 + o * 0.8;
  // Defensive Doctrine: each rank hardens armor effectiveness.
  const defenseMod = 1 + defenseLevel * 0.15;
  return { min: Math.floor(score * 0.35 * defenseMod), max: Math.floor(score * 0.7 * defenseMod) };
}

// Compute an actual damage roll from attacker weapon tier and defender armor.
// Attacker level adds a small experience bonus to hit damage.
function rollDamage(
  attackerWeaponTier: number,
  defender: { armor_tier?: number | null; helmet_tier?: number | null; legs_tier?: number | null; offhand_tier?: number | null },
  defenseLevel: number = 0,
  attackerLevel: number = 1,
) {
  const dmg = weaponDamageRange(attackerWeaponTier);
  const mit = armorMitigation(defender, defenseLevel);
  const lvlBonus = Math.max(0, attackerLevel - 1); // +1 damage per level above 1
  const min = Math.max(3, dmg.min + lvlBonus - mit.max);
  const max = Math.max(min + 1, dmg.max + lvlBonus - mit.min);
  return rand(min, max);
}


export const getLudusState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, gladiators, matches, skills, hall, socialEvents] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("gladiators").select("*").eq("owner_id", userId).order("created_at", { ascending: true }),
      supabase.from("matches").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("ludus_skills").select("*").eq("owner_id", userId),
      supabase.from("hall_of_fame").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("social_events").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    const medicusLevel = profile.data?.medicus_level ?? 1;
    const trainingLevel = profile.data?.training_level ?? 1;
    return {
      profile: profile.data,
      // Settle passive regen for display without persisting it — the next
      // action that actually changes a gladiator's health (fight, heal,
      // train) writes the real, up-to-date value.
      gladiators: (gladiators.data ?? []).map(g => ({ ...g, health: effectiveHealth(g, medicusLevel, trainingLevel) })),
      matches: matches.data ?? [],
      skills: skills.data ?? [],
      hallOfFame: hall.data ?? [],
      socialEvents: socialEvents.data ?? [],
    };
  });


// ---------- FACILITY UPGRADE ----------
export const upgradeFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    facility: z.enum(["training", "scouting", "medicus", "armory", "pantry", "social", "relics"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const col = `${data.facility}_level` as "training_level" | "scouting_level" | "medicus_level" | "armory_level" | "pantry_level" | "social_level" | "relics_level";
    const curr = (profile as unknown as Record<string, number>)[col];
    const maxLevel = data.facility === "training" ? TRAINING_MAX_LEVEL : MAX_FACILITY;
    if (curr >= maxLevel) throw new Error("Facility already at max level");
    const cost = data.facility === "training" ? trainingFacilityCost(curr) : FACILITY_COST(curr);
    const next = curr + 1;

    await spendDenarii(supabaseAdmin, userId, cost, `Need ${cost} denarii`);

    const levelPatch =
      data.facility === "training" ? { training_level: next } :
      data.facility === "scouting" ? { scouting_level: next } :
      data.facility === "medicus" ? { medicus_level: next } :
      data.facility === "pantry" ? { pantry_level: next } :
      data.facility === "social" ? { social_level: next } :
      data.facility === "relics" ? { relics_level: next } :
      { armory_level: next };
    const { error } = await supabaseAdmin.from("profiles").update(levelPatch as never).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, cost, newLevel: next };
  });

// Pantry capacity: level 1 = 3 humans / 1 beast; +3 humans and +1 beast per level.
export function pantryCapacity(pantryLevel: number) {
  const lvl = Math.max(1, pantryLevel);
  return { humans: lvl * 3, beasts: lvl };
}

// ---------- SKILL UPGRADE ----------
export const upgradeSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    weaponType: z.enum(["gladius", "spear", "net", "dual", "beast_lion", "beast_tiger", "beast_elephant", "beast_rhino", "defense"]),
  }).parse(input))

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("denarii").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: existing } = await supabase
      .from("ludus_skills")
      .select("*")
      .eq("owner_id", userId)
      .eq("weapon_type", data.weaponType)
      .maybeSingle();
    const curr = existing?.level ?? 0;
    if (curr >= MAX_SKILL) throw new Error("Skill already mastered");
    const cost = SKILL_COST(curr);

    await spendDenarii(supabaseAdmin, userId, cost, `Need ${cost} denarii`);

    if (existing) {
      const { error } = await supabaseAdmin.from("ludus_skills").update({ level: curr + 1 }).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("ludus_skills").insert({
        owner_id: userId, weapon_type: data.weaponType, level: 1,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true, cost, newLevel: curr + 1 };
  });

// ---------- RECRUIT ----------
export const recruitGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const COST = recruitCost(profile.scouting_level);

    const g = generateGladiator(profile.scouting_level);

    // Pantry capacity gate — count living roster by type.
    const { data: roster } = await supabase
      .from("gladiators").select("is_beast,status").eq("owner_id", userId);
    const living = (roster ?? []).filter((r) => r.status !== "dead");
    const humans = living.filter((r) => !r.is_beast).length;
    const beasts = living.filter((r) => r.is_beast).length;
    const cap = pantryCapacity((profile as unknown as { pantry_level: number }).pantry_level ?? 1);
    if (g.is_beast && beasts >= cap.beasts) throw new Error(`Your pantry cannot feed another beast (${beasts}/${cap.beasts}). Upgrade the Pantry.`);
    if (!g.is_beast && humans >= cap.humans) throw new Error(`Your pantry is full (${humans}/${cap.humans} gladiators). Upgrade the Pantry.`);

    await spendDenarii(supabaseAdmin, userId, COST, `Scouting fee: ${COST} denarii`);

    const { error: insertErr } = await supabaseAdmin.from("gladiators").insert({ owner_id: userId, ...g, total_invested: COST });
    if (insertErr) throw new Error(insertErr.message);
    return { ok: true, isBeast: g.is_beast, name: g.name };
  });


// ---------- TRAIN ----------
export const trainGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    stat: z.enum(["strength", "agility", "stamina", "technique"]),
    times: z.number().int().min(1).max(20).optional().default(1),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const COST = trainCost(profile.training_level);

    const { data: g } = await supabase.from("gladiators")
      .select("id,status,injury_until,strength,agility,stamina,technique,health,health_updated_at,total_invested")
      .eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("Gladiator has fallen");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");

    const cap = statCap(profile.training_level);
    const startVal = g[data.stat] as number;
    if (startVal >= cap) throw new Error(`Stat capped at ${cap} — upgrade Training Yard`);

    // Simulate up to `times` sessions, stopping early if the stat caps out —
    // only sessions that actually ran get charged. Better training = bigger
    // gains per session.
    const bigChance = trainBigChance(profile.training_level);
    let val = startVal;
    let sessions = 0;
    for (let i = 0; i < data.times; i++) {
      if (val >= cap) break;
      const gain = Math.random() < bigChance ? 2 : 1;
      val = Math.min(cap, val + gain);
      sessions++;
    }
    const totalGain = val - startVal;
    const totalCost = COST * sessions;

    await spendDenarii(supabaseAdmin, userId, totalCost, `Training costs ${totalCost} denarii`);

    const basePatch: Record<string, number | string | null> = { total_invested: (g.total_invested ?? 0) + totalCost };
    const patch =
      // Strength drives max health — bump current (regen-settled) health by
      // the same amount gained so training doesn't retroactively wound a
      // fighter, and persist the settled value under a fresh timestamp.
      data.stat === "strength" ? { ...basePatch, strength: val, health_updated_at: new Date().toISOString(), health: Math.min(maxHealth(val), effectiveHealth(g, profile.medicus_level, profile.training_level) + totalGain * 5) } :
      data.stat === "agility" ? { ...basePatch, agility: val } :
      data.stat === "stamina" ? { ...basePatch, stamina: val } :
      { ...basePatch, technique: val };
    const { error } = await supabaseAdmin.from("gladiators").update(patch).eq("id", g.id);
    if (error) throw new Error(error.message);
    return { ok: true, gain: totalGain, sessions, stat: data.stat };
  });


// ---------- EQUIP ----------
export const upgradeEquipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    slot: z.enum(["weapon", "armor", "helmet", "legs", "offhand"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators")
      .select("id,status,is_beast,weapon_tier,armor_tier,helmet_tier,legs_tier,offhand_tier,total_invested")
      .eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("Gladiator has fallen");
    if (g.is_beast && data.slot === "weapon") throw new Error("Beasts have no weapon slot");

    const tierField = `${data.slot}_tier` as
      "weapon_tier" | "armor_tier" | "helmet_tier" | "legs_tier" | "offhand_tier";
    const currentTier = (g as unknown as Record<string, number>)[tierField] ?? 1;
    if (currentTier >= MAX_GEAR_TIER) throw new Error("Already at master tier");
    const nextTier = currentTier + 1;
    const reqArmory = requiredArmoryLevel(nextTier);
    if (profile.armory_level < reqArmory) throw new Error(`The armory must be level ${reqArmory} to forge tier ${nextTier} gear`);
    const cost = gearCost(data.slot, currentTier, profile.armory_level);

    await spendDenarii(supabaseAdmin, userId, cost, `Need ${cost} denarii`);

    const patch = { [tierField]: currentTier + 1, total_invested: (g.total_invested ?? 0) + cost };
    const { error } = await supabaseAdmin.from("gladiators").update(patch as never).eq("id", g.id);
    if (error) throw new Error(error.message);
    return { ok: true, cost };
  });


// ---------- HEAL ----------
export const healGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gladiatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("The physician cannot revive the dead");

    const hpMax = maxHealth(g.strength);
    const currentHealth = effectiveHealth(g, profile.medicus_level, profile.training_level);
    const missing = hpMax - currentHealth;
    if (missing <= 0 && !g.injury_until) throw new Error("Already at full health");
    const cost = healCost(missing, profile.medicus_level, g.level);

    await spendDenarii(supabaseAdmin, userId, cost, `Physician needs ${cost} denarii`);

    const { error } = await supabaseAdmin.from("gladiators").update({
      health: hpMax,
      health_updated_at: new Date().toISOString(),
      injury_until: null,
      total_invested: (g.total_invested ?? 0) + cost,
    }).eq("id", g.id);
    if (error) throw new Error(error.message);
    return { ok: true, cost };
  });


// ---------- DISMISS ----------
export const dismissGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gladiatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gladiators").delete().eq("id", data.gladiatorId).eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ARENA TIERS ----------
// Each venue is gated by ludus fame (reputation), gladiator level, and gladiator fame (wins).
export type ArenaTier = {
  key: string;
  label: string;
  flavor: string;
  imageUrl: string;      // arena illustration
  reqFame: number;       // ludus reputation
  reqLevel: number;      // gladiator level
  reqWins: number;       // gladiator wins
  powerMin: number;      // opponent power lower bound
  powerMax: number;      // opponent power upper bound
  hp: number;            // opponent HP pool for this tier
  reward: number;        // base denarii
  xp: number;            // base XP
  rep: number;           // fame on win
  opponents: string[];   // flavor opponent pool
};

export const ARENA_TIERS: ArenaTier[] = [
  {
    key: "backwater", label: "Backwater Pits",
    flavor: "Muddy village pits — a purse of copper and jeering peasants.",
    imageUrl: backwaterImg,
    reqFame: 0, reqLevel: 1, reqWins: 0,
    powerMin: 50, powerMax: 110, hp: 100, reward: 70, xp: 35, rep: 1,
    opponents: ["Drunken Brawler", "Runaway Slave", "Village Bully", "Starving Thief"],
  },
  {
    key: "wayside", label: "Wayside Arena",
    flavor: "A fenced yard by the crossroads inn — bigger crowds, real wagers.",
    imageUrl: waysideImg,
    reqFame: 2, reqLevel: 1, reqWins: 0,
    powerMin: 120, powerMax: 300, hp: 130, reward: 110, xp: 50, rep: 2,
    opponents: ["Wayside Brawler", "Cart Driver Turned Fighter", "Indebted Gambler", "Local Tough"],
  },
  {
    key: "local", label: "Local Games",
    flavor: "Small town munera — a wooden stand and a modest crowd.",
    imageUrl: localImg,
    reqFame: 5, reqLevel: 2, reqWins: 1,
    powerMin: 300, powerMax: 700, hp: 160, reward: 160, xp: 75, rep: 3,
    opponents: ["Provincial Auctoratus", "Retired Legionary", "Pit Veteran", "Ostian Bruiser"],
  },
  {
    key: "provincial", label: "Provincial Munera",
    flavor: "A magistrate's games — proper editors, painted programs, real steel.",
    imageUrl: provincialImg,
    reqFame: 25, reqLevel: 3, reqWins: 3,
    powerMin: 900, powerMax: 1300, hp: 230, reward: 320, xp: 130, rep: 6,
    opponents: ["Praetorian Washout", "Iberian Veteran", "Champion of Ostia", "Nubian Slayer"],
  },
  {
    key: "capua", label: "Grand Games of Capua",
    flavor: "Capua's arena, where fortunes are made and legions bet their pay.",
    imageUrl: capuaImg,
    reqFame: 75, reqLevel: 5, reqWins: 8,
    powerMin: 1300, powerMax: 1700, hp: 280, reward: 650, xp: 240, rep: 14,
    opponents: ["Champion of Capua", "The Bloody Bull", "Marcus Ferrus", "The Thracian Wolf"],
  },
  {
    key: "colosseum", label: "Colosseum of Rome",
    flavor: "The Flavian Amphitheatre. Fifty thousand voices thirsting for blood.",
    imageUrl: colosseumImg,
    reqFame: 200, reqLevel: 8, reqWins: 20,
    powerMin: 1700, powerMax: 2200, hp: 330, reward: 1300, xp: 420, rep: 30,
    opponents: ["Priscus the Undefeated", "Verus of the Palatine", "Flamma Redivivus", "The Iron Senator"],
  },
  {
    key: "emperor", label: "Emperor's Spectacle",
    flavor: "The Emperor himself watches. Death here becomes legend.",
    imageUrl: emperorImg,
    reqFame: 500, reqLevel: 12, reqWins: 40,
    powerMin: 2400, powerMax: 3200, hp: 440, reward: 2800, xp: 800, rep: 70,
    opponents: ["Spartacus Reborn", "Hermes of Thrace", "The Emperor's Champion", "Tetraites the Immortal"],
  },
];

export function tierUnlockReason(
  tier: ArenaTier,
  ludusFame: number,
  gladLevel: number,
  gladWins: number,
): string | null {
  if (ludusFame < tier.reqFame) return `Ludus needs ${tier.reqFame} fame`;
  if (gladLevel < tier.reqLevel) return `Gladiator must be level ${tier.reqLevel}`;
  if (gladWins < tier.reqWins) return `Gladiator needs ${tier.reqWins} wins`;
  return null;
}

const TIER_KEYS = ARENA_TIERS.map(t => t.key) as [string, ...string[]];

// Reflex-fight pacing (pit fights and team battles both use this): 3
// charges per gladiator, each on its own cooldown. Stamina shortens the
// cooldown, scaled relative to the CURRENT stat cap (not a fixed number) so
// it stays correct if the cap ever changes — halved at max stamina.
export const PIT_MAX_CHARGES = 3;
export const PIT_BASE_COOLDOWN_HOURS = 24;
export function reflexCooldownHours(stamina: number, trainingLevel: number): number {
  const cap = statCap(trainingLevel);
  const reduction = cap > 0 ? 0.5 * Math.min(1, stamina / cap) : 0;
  return PIT_BASE_COOLDOWN_HOURS * (1 - reduction);
}
// recentDesc: this gladiator's timestamps for this charge pool, most recent first.
function chargeAvailability(recentDesc: string[], cooldownHours: number, maxCharges: number) {
  const cutoff = Date.now() - cooldownHours * 3600_000;
  const active = recentDesc.filter(ts => new Date(ts).getTime() > cutoff).slice(0, maxCharges);
  const chargesAvailable = maxCharges - active.length;
  const nextAvailableAt = chargesAvailable > 0
    ? null
    : new Date(new Date(active[active.length - 1]).getTime() + cooldownHours * 3600_000).toISOString();
  return { chargesAvailable, nextAvailableAt };
}

// ---------- FIGHT ----------
export const fightMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    difficulty: z.enum(TIER_KEYS as unknown as [string, ...string[]]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    const currentHealth = effectiveHealth(g, profile.medicus_level, profile.training_level);
    if (currentHealth < 30) throw new Error("Gladiator too wounded to fight");

    const tier = ARENA_TIERS.find(t => t.key === data.difficulty);
    if (!tier) throw new Error("Unknown arena");
    const lock = tierUnlockReason(tier, profile.reputation, g.level, g.wins);
    if (lock) throw new Error(lock);

    const cooldownHours = reflexCooldownHours(g.stamina, profile.training_level);
    const { data: recentPitFights } = await supabase
      .from("matches")
      .select("created_at")
      .eq("gladiator_id", g.id)
      .in("difficulty", TIER_KEYS)
      .eq("refunded_charge", false)
      .order("created_at", { ascending: false })
      .limit(PIT_MAX_CHARGES);
    const { chargesAvailable, nextAvailableAt } = chargeAvailability(
      (recentPitFights ?? []).map(m => m.created_at),
      cooldownHours,
      PIT_MAX_CHARGES,
    );
    if (chargesAvailable <= 0 && nextAvailableAt) {
      const mins = Math.max(1, Math.ceil((new Date(nextAvailableAt).getTime() - Date.now()) / 60000));
      const hrs = Math.floor(mins / 60), rem = mins % 60;
      throw new Error(`${g.name} is resting — next pit fight in ${hrs}h ${rem}m`);
    }

    const { data: skillRow } = await supabase
      .from("ludus_skills").select("level")
      .eq("owner_id", userId).eq("weapon_type", g.weapon_type).maybeSingle();
    const skillLevel = skillRow?.level ?? 0;
    const { data: defenseRow } = await supabase
      .from("ludus_skills").select("level")
      .eq("owner_id", userId).eq("weapon_type", "defense").maybeSingle();
    const defenseLevel = defenseRow?.level ?? 0;

    const myPower = gladiatorPower({ ...g, health: currentHealth }, skillLevel);
    const opponentPower = rand(tier.powerMin, tier.powerMax);
    const opponentName = g.is_beast
      ? pick(["Doomed Slave", "Damnatus", "Condemned Thief"])
      : pick(tier.opponents);

    const log: string[] = [];
    log.push(`${g.name} enters ${tier.label} to face ${opponentName}.`);
    if (skillLevel > 0) log.push(`Style mastery: ${WEAPON_LABELS[g.weapon_type] ?? g.weapon_type} — rank ${skillLevel}.`);
    if (defenseLevel > 0) log.push(`Defensive doctrine: rank ${defenseLevel} — your armor holds firmer.`);
    log.push(`The crowd roars. Power ${myPower} vs ${opponentPower}.`);

    // Derive opponent gear tier from arena strength (1..8).
    const oppGearTier = Math.max(1, Math.min(8, Math.round((opponentPower / 2200) * 8)));
    const opponent = {
      weapon_tier: oppGearTier, armor_tier: oppGearTier,
      helmet_tier: oppGearTier, legs_tier: oppGearTier, offhand_tier: oppGearTier,
    };
    const myDmg = weaponDamageRange(g.weapon_tier);
    const myMit = armorMitigation(g, defenseLevel);
    const myChance = winChance(myPower, opponentPower);
    log.push(`Win chance: ${Math.round(myChance * 100)}%. Your blade strikes for ${myDmg.min}–${myDmg.max}; your armor absorbs ${myMit.min}–${myMit.max}.`);

    const myMaxHp = maxHealth(g.strength);
    const oppMaxHp = tier.hp;
    // Start from the gladiator's actual current health, not a fresh full
    // bar — a wounded fighter genuinely risks going down faster here.
    let myHp = currentHealth, oppHp = oppMaxHp;
    // Round cap must comfortably outlast the HP pools involved (now up to
    // ~440 for tanky/high-tier matchups) or fights get cut short by this
    // ceiling before anyone's health actually runs out.
    const rounds = rand(15, 25);
    const fightRounds: FightRound[] = [];
    for (let i = 1; i <= rounds && myHp > 0 && oppHp > 0; i++) {
      if (Math.random() < myChance) {
        const dmg = rollDamage(g.weapon_tier, opponent, 0, g.level);
        oppHp -= dmg;
        const text = `Round ${i}: ${g.name} lands a blow for ${dmg}.`;
        log.push(text);
        // Pit fights are never lethal — floor the displayed HP at 1, not 0,
        // so the animation never looks like a kill.
        fightRounds.push({ attacker: "me", damage: dmg, myHp: Math.max(1, myHp), oppHp: Math.max(1, oppHp), text });
      } else {
        const dmg = rollDamage(oppGearTier, g, defenseLevel, tier.reqLevel);
        myHp -= dmg;
        const text = `Round ${i}: ${opponentName} strikes ${g.name} for ${dmg}.`;
        log.push(text);
        fightRounds.push({ attacker: "opponent", damage: dmg, myHp: Math.max(1, myHp), oppHp: Math.max(1, oppHp), text });
      }
    }


    const won = oppHp <= myHp;
    const denariiGained = applyGoldBonus(
      won ? tier.reward + rand(0, Math.floor(tier.reward * 0.2)) : Math.floor(tier.reward * 0.12),
      profile.relics,
      profile.boss_kills as Record<string, number>,
    );
    const xpGained = won ? tier.xp : Math.floor(tier.xp * 0.4);
    const repGained = won ? tier.rep : 0;

    const damageTaken = Math.max(5, currentHealth - Math.max(0, myHp));
    // Pit fights never kill — the loser is left at 1 HP, badly hurt but alive.
    let newHealth = Math.max(1, currentHealth - damageTaken);

    const newXp = g.experience + xpGained;
    const xpForNext = g.level * 100;
    const leveledUp = newXp >= xpForNext;
    const newLevel = leveledUp ? g.level + 1 : g.level;
    const finalXp = leveledUp ? newXp - xpForNext : newXp;

    let injuryUntil: string | null = null;
    if (leveledUp) {
      // Leveling up fully heals the gladiator and shakes off any wound this
      // same fight would otherwise have inflicted, and this match doesn't
      // burn a pit-fight charge — see refunded_charge below.
      newHealth = myMaxHp;
    } else if (Math.random() < pitInjuryChance(currentHealth / myMaxHp)) {
      // Injury risk scales with how wounded the gladiator was *entering*
      // this fight (10% baseline at full health, up to 60% near death) —
      // not with how rough this particular fight was, since pit fights
      // running the full HP pool now regularly push a fighter toward the
      // 1 HP floor regardless.
      const hours = injuryHours(rand(12, 24), g.agility, profile.medicus_level, profile.training_level);
      injuryUntil = new Date(Date.now() + hours * 3600_000).toISOString();
      log.push(`${g.name} picks up a nasty wound — ${hours}h to recover.`);
    }

    log.push(won
      ? `Victory! The crowd showers ${g.name} with praise. +${denariiGained} denarii, +${xpGained} XP.`
      : `Defeat. ${g.name} limps from the sand. +${denariiGained} denarii.`);
    if (leveledUp) {
      log.push(`⚔ ${g.name} advances to level ${newLevel} — fully healed, and ready to fight again!`);
    }

    const gladPatch = {
      health: newHealth,
      health_updated_at: new Date().toISOString(),
      injury_until: injuryUntil,
      experience: finalXp,
      level: newLevel,
      wins: g.wins + (won ? 1 : 0),
      losses: g.losses + (won ? 0 : 1),
    };

    const { error: gErr } = await supabaseAdmin.from("gladiators").update(gladPatch).eq("id", g.id);
    if (gErr) throw new Error(gErr.message);

    await supabaseAdmin.from("profiles").update({
      denarii: profile.denarii + denariiGained,
      reputation: profile.reputation + repGained,
    }).eq("id", userId);

    await supabase.from("matches").insert({
      owner_id: userId,
      gladiator_id: g.id,
      opponent_name: opponentName,
      opponent_power: opponentPower,
      difficulty: data.difficulty,
      result: won ? "win" : "loss",
      xp_gained: xpGained,
      denarii_gained: denariiGained,
      reputation_gained: repGained,
      refunded_charge: leveledUp,
      log,
    });

    return { won, log, denariiGained, xpGained, repGained, rounds: fightRounds, myMaxHp, myStartHp: currentHealth, oppMaxHp, opponentName };
  });

// Per-gladiator pit-fight charge status, so the UI can show cooldowns
// proactively instead of only after a blocked fight attempt.
export const getPitFightAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("training_level").eq("id", userId).maybeSingle();
    const trainingLevel = profile?.training_level ?? 1;
    const { data: gladiators } = await supabase.from("gladiators").select("id,stamina").eq("owner_id", userId);

    const windowStart = new Date(Date.now() - PIT_BASE_COOLDOWN_HOURS * 3600_000).toISOString();
    const { data: recentFights } = await supabase
      .from("matches")
      .select("gladiator_id,created_at")
      .eq("owner_id", userId)
      .in("difficulty", TIER_KEYS)
      .eq("refunded_charge", false)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    const byGladiator = new Map<string, string[]>();
    for (const m of recentFights ?? []) {
      const list = byGladiator.get(m.gladiator_id) ?? [];
      list.push(m.created_at);
      byGladiator.set(m.gladiator_id, list);
    }

    const availability: Record<string, { chargesAvailable: number; nextAvailableAt: string | null; cooldownHours: number }> = {};
    for (const g of gladiators ?? []) {
      const cooldownHours = reflexCooldownHours(g.stamina, trainingLevel);
      const { chargesAvailable, nextAvailableAt } = chargeAvailability(byGladiator.get(g.id) ?? [], cooldownHours, PIT_MAX_CHARGES);
      availability[g.id] = { chargesAvailable, nextAvailableAt, cooldownHours };
    }
    return { availability };
  });

// ============= Lines 524-706 replaced =============
// ============================================================
// PVP — post a challenge, other ludi accept with a similar champion
// ============================================================

// Match rating used to gate "similar stats" pairings.
export function matchRating(g: {
  level: number; strength: number; agility: number; stamina: number; technique: number;
  weapon_tier: number; armor_tier: number;
  helmet_tier?: number | null; legs_tier?: number | null; offhand_tier?: number | null;
}): number {
  const stats = g.strength + g.agility + g.stamina + g.technique;
  const gear = g.weapon_tier * 2 + g.armor_tier * 2 + (g.helmet_tier ?? 1) + (g.legs_tier ?? 1) + (g.offhand_tier ?? 1);
  return g.level * 10 + stats + gear;
}

// Similar = challenger's rating within ±25% of acceptor's rating.
export const SIMILAR_TOLERANCE = 0.25;
export function isSimilarRating(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const base = Math.max(a, b);
  return diff / Math.max(1, base) <= SIMILAR_TOLERANCE;
}

// ---------- POST CHALLENGE ----------
export const postPvpChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    toDeath: z.boolean().optional().default(false),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("medicus_level,training_level").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("Gladiator has fallen");
    if (g.status === "challenging") throw new Error("Already posted for a challenge");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    if (effectiveHealth(g, profile.medicus_level, profile.training_level) < 30) throw new Error("Gladiator too wounded");

    const rating = matchRating(g);
    const { data: inserted, error } = await supabaseAdmin.from("pvp_challenges").insert({
      challenger_id: userId,
      challenger_gladiator_id: g.id,
      rating,
      to_death: !!data.toDeath,
      status: "open",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("gladiators").update({ status: "challenging" }).eq("id", g.id);
    return { ok: true, id: inserted.id };
  });

// ---------- CANCEL CHALLENGE ----------
export const cancelPvpChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ challengeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabase.from("pvp_challenges").select("*").eq("id", data.challengeId).eq("challenger_id", userId).maybeSingle();
    if (!c) throw new Error("Challenge not found");
    if (c.status !== "open") throw new Error("Challenge already resolved");
    await supabaseAdmin.from("pvp_challenges").delete().eq("id", c.id).eq("challenger_id", userId);
    await supabaseAdmin.from("gladiators").update({ status: "idle" }).eq("id", c.challenger_gladiator_id).eq("owner_id", userId);
    return { ok: true };
  });

// ---------- SEED BOT CHALLENGES ----------
// Ensure the arena always has open offers from rival ludi. If any non-caller
// owner has 0 open challenges and a fit idle gladiator, auto-post one.
async function ensureBotChallenges(currentUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: openByOwner } = await supabaseAdmin
    .from("pvp_challenges")
    .select("challenger_id")
    .eq("status", "open");
  const havingOpen = new Set((openByOwner ?? []).map(o => o.challenger_id));

  const { data: bots } = await supabaseAdmin
    .from("gladiators")
    .select("id,owner_id,level,strength,agility,stamina,technique,weapon_tier,armor_tier,helmet_tier,legs_tier,offhand_tier,health,status,injury_until")
    .neq("owner_id", currentUserId)
    .eq("status", "idle")
    .gte("health", 60);
  if (!bots) return;

  const nowIso = new Date().toISOString();
  const byOwner = new Map<string, typeof bots>();
  for (const b of bots) {
    if (havingOpen.has(b.owner_id)) continue;
    if (b.injury_until && b.injury_until > nowIso) continue;
    const list = byOwner.get(b.owner_id) ?? [];
    list.push(b);
    byOwner.set(b.owner_id, list);
  }

  for (const [owner, list] of byOwner) {
    const g = list[Math.floor(Math.random() * list.length)];
    const rating = matchRating(g);
    await supabaseAdmin.from("pvp_challenges").insert({
      challenger_id: owner,
      challenger_gladiator_id: g.id,
      rating,
      to_death: Math.random() < 0.25,
      status: "open",
    });
    await supabaseAdmin.from("gladiators").update({ status: "challenging" }).eq("id", g.id);
  }
}

// ---------- LIST OPEN CHALLENGES ----------
export const listOpenPvpChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ myGladiatorId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureBotChallenges(userId);

    const [openRes, mineRes] = await Promise.all([
      supabase.from("pvp_challenges").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(60),
      supabase.from("pvp_challenges").select("*").eq("challenger_id", userId).eq("status", "open").order("created_at", { ascending: false }),
    ]);
    const rivals = (openRes.data ?? []).filter(c => c.challenger_id !== userId);
    const gladiatorIds = [...new Set([...rivals, ...(mineRes.data ?? [])].map(c => c.challenger_gladiator_id))];
    const ownerIds = [...new Set(rivals.map(c => c.challenger_id))];

    const [gladRes, ownerRes] = await Promise.all([
      gladiatorIds.length
        ? supabase.from("gladiators").select("id,owner_id,name,class,weapon_type,is_beast,level,wins,losses,health,strength,agility,stamina,technique,weapon_tier,armor_tier,helmet_tier,legs_tier,offhand_tier")
            .in("id", gladiatorIds)
        : Promise.resolve({ data: [] as never[] }),
      ownerIds.length
        ? supabase.rpc("get_pvp_profiles", { p_ids: ownerIds })
        : Promise.resolve({ data: [] as never[] }),
    ]);
    const gMap = new Map((gladRes.data ?? []).map(g => [g.id, g]));
    const oMap = new Map((ownerRes.data ?? []).map(o => [o.id, o]));

    let myRating: number | null = null;
    if (data.myGladiatorId) {
      const { data: mine } = await supabase
        .from("gladiators")
        .select("id,level,strength,agility,stamina,technique,weapon_tier,armor_tier,helmet_tier,legs_tier,offhand_tier")
        .eq("id", data.myGladiatorId).eq("owner_id", userId).maybeSingle();
      if (mine) myRating = matchRating(mine);
    }

    const openChallenges = rivals.map(c => {
      const g = gMap.get(c.challenger_gladiator_id);
      const owner = oMap.get(c.challenger_id);
      const similar = myRating != null && isSimilarRating(myRating, c.rating);
      return {
        id: c.id,
        rating: c.rating,
        to_death: c.to_death,
        created_at: c.created_at,
        similar,
        ludus_name: owner?.ludus_name ?? "Unknown Ludus",
        ludus_fame: owner?.reputation ?? 0,
        gladiator: g ?? null,
      };
    });
    const myOffers = (mineRes.data ?? []).map(c => {
      const g = gMap.get(c.challenger_gladiator_id);
      return {
        id: c.id, rating: c.rating, to_death: c.to_death, created_at: c.created_at,
        gladiator: g ?? null,
      };
    });
    return { myRating, openChallenges, myOffers };
  });

// ---------- ACCEPT CHALLENGE ----------
export const acceptPvpChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    challengeId: z.string().uuid(),
    myGladiatorId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.myGladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("Gladiator has fallen");
    if (g.status === "challenging") throw new Error("Gladiator is currently posted in your own offer");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    const myCurrentHealth = effectiveHealth(g, profile.medicus_level, profile.training_level);
    if (myCurrentHealth < 30) throw new Error("Gladiator too wounded");

    const { data: c } = await supabase.from("pvp_challenges").select("*").eq("id", data.challengeId).maybeSingle();
    if (!c) throw new Error("Challenge not found");
    if (c.status !== "open") throw new Error("Challenge already resolved");
    if (c.challenger_id === userId) throw new Error("Cannot accept your own challenge");

    const myRating = matchRating(g);
    if (!isSimilarRating(myRating, c.rating)) {
      throw new Error(`Not a similar match (your ${myRating} vs their ${c.rating}). Pick a champion of closer standing.`);
    }

    const { data: opp } = await supabaseAdmin.from("gladiators").select("*").eq("id", c.challenger_gladiator_id).maybeSingle();
    if (!opp) throw new Error("Opposing gladiator no longer exists");
    if (opp.status === "dead") throw new Error("Opposing champion has fallen");
    const { data: oppFacilities } = await supabaseAdmin.from("profiles").select("medicus_level,training_level").eq("id", opp.owner_id).maybeSingle();
    const oppMedicusLevel = oppFacilities?.medicus_level ?? 1;
    const oppTrainingLevel = oppFacilities?.training_level ?? 1;
    const oppCurrentHealth = effectiveHealth(opp, oppMedicusLevel, oppTrainingLevel);

    // Atomically claim the challenge before simulating the fight — two
    // players accepting the same "open" challenge in the same window could
    // otherwise both pass the status check above and both resolve it,
    // duplicating rewards and double-updating the challenger's gladiator.
    const { data: claimed } = await supabaseAdmin
      .from("pvp_challenges")
      .update({ status: "accepted" })
      .eq("id", c.id)
      .eq("status", "open")
      .select()
      .maybeSingle();
    if (!claimed) throw new Error("Challenge already resolved");

    const toDeath = !!c.to_death;
    const rewardMult = toDeath ? 5 : 1;

    const { data: mySkill } = await supabase.from("ludus_skills").select("level").eq("owner_id", userId).eq("weapon_type", g.weapon_type).maybeSingle();
    const { data: oppSkill } = await supabaseAdmin.from("ludus_skills").select("level").eq("owner_id", opp.owner_id).eq("weapon_type", opp.weapon_type).maybeSingle();
    const { data: myDefense } = await supabase.from("ludus_skills").select("level").eq("owner_id", userId).eq("weapon_type", "defense").maybeSingle();
    const { data: oppDefense } = await supabaseAdmin.from("ludus_skills").select("level").eq("owner_id", opp.owner_id).eq("weapon_type", "defense").maybeSingle();
    const myPower = gladiatorPower({ ...g, health: myCurrentHealth }, mySkill?.level ?? 0);
    const oppPower = gladiatorPower({ ...opp, health: oppCurrentHealth }, oppSkill?.level ?? 0);
    const myDefenseLevel = myDefense?.level ?? 0;
    const oppDefenseLevel = oppDefense?.level ?? 0;

    const log: string[] = [];
    log.push(`${g.name} answers the call of ${opp.name}'s ludus.`);
    if (toDeath) log.push("⚔ Sine missione — a fight to the death. No quarter, no mercy.");
    log.push(`Power ${myPower} vs ${oppPower}.`);
    const myDmg = weaponDamageRange(g.weapon_tier);
    const oppDmg = weaponDamageRange(opp.weapon_tier);
    const myChance = winChance(myPower, oppPower);
    log.push(`${g.name}: ${myDmg.min}–${myDmg.max} dmg · ${opp.name}: ${oppDmg.min}–${oppDmg.max} dmg. Win chance: ${Math.round(myChance * 100)}%.`);
    if (myDefenseLevel > 0) log.push(`${g.name} adopts defensive stance — rank ${myDefenseLevel}.`);
    if (oppDefenseLevel > 0) log.push(`${opp.name} adopts defensive stance — rank ${oppDefenseLevel}.`);
    const myMaxHp = maxHealth(g.strength);
    const oppMaxHp = maxHealth(opp.strength);
    // Start from each fighter's actual current health, not a fresh full bar.
    let myHp = myCurrentHealth, oHp = oppCurrentHealth;
    const fightRounds: FightRound[] = [];
    // Same reasoning as fightMatch — cap must outlast the real HP pools.
    for (let i = 1; i <= 20 && myHp > 0 && oHp > 0; i++) {
      if (Math.random() < myChance) {
        const d = rollDamage(g.weapon_tier, opp, oppDefenseLevel, g.level);
        oHp -= d;
        const text = `Round ${i}: ${g.name} strikes for ${d}.`;
        log.push(text);
        // Only a sine missione (toDeath) fight can actually kill — otherwise
        // floor the displayed HP at 1 so the animation never shows a kill
        // that isn't going to happen.
        fightRounds.push({ attacker: "me", damage: d, myHp: Math.max(toDeath ? 0 : 1, myHp), oppHp: Math.max(toDeath ? 0 : 1, oHp), text });
      } else {
        const d = rollDamage(opp.weapon_tier, g, myDefenseLevel, opp.level);
        myHp -= d;
        const text = `Round ${i}: ${opp.name} strikes for ${d}.`;
        log.push(text);
        fightRounds.push({ attacker: "opponent", damage: d, myHp: Math.max(toDeath ? 0 : 1, myHp), oppHp: Math.max(toDeath ? 0 : 1, oHp), text });
      }
    }

    const won = oHp <= myHp;

    const denariiGained = applyGoldBonus(won ? (200 + rand(0, 80)) * rewardMult : 30, profile.relics, profile.boss_kills as Record<string, number>);
    const xpGained = won ? 140 * rewardMult : 50;
    const repGained = won ? 8 * rewardMult : -2;

    const damageTaken = Math.max(5, myCurrentHealth - Math.max(0, myHp));
    const myDied = toDeath && !won;
    const myNewXp = g.experience + xpGained;
    const myXpForNext = g.level * 100;
    const myLeveledUp = !myDied && myNewXp >= myXpForNext;
    const myNewLevel = myLeveledUp ? g.level + 1 : g.level;
    const myFinalXp = myLeveledUp ? myNewXp - myXpForNext : myNewXp;

    // Only sine missione can kill — otherwise the loser is left at 1 HP.
    let newHealth = Math.max(toDeath ? 0 : 1, myCurrentHealth - damageTaken);
    let injuryUntil: string | null = null;
    if (myDied) {
      newHealth = 0;
      log.push(`${g.name} falls in the sand. The crowd chants "Iugula!" — the blade is driven home.`);
    } else if (myLeveledUp) {
      // Leveling up fully heals the gladiator and shakes off any wound this
      // same fight would otherwise have inflicted.
      newHealth = myMaxHp;
    } else if ((newHealth <= 1 || damageTaken > myMaxHp * 0.6) && newHealth > 0) {
      const hours = injuryHours(rand(12, 24), g.agility, profile.medicus_level, profile.training_level);
      injuryUntil = new Date(Date.now() + hours * 3600_000).toISOString();
      log.push(`${g.name} is injured for ${hours}h.`);
    }
    log.push(won
      ? (toDeath ? `${g.name} stands victorious over ${opp.name}'s corpse. The purse is enormous.` : `Victory over ${opp.name}! Fame spreads through the provinces.`)
      : (toDeath ? `${opp.name}'s ludus claims your champion's life.` : `${opp.name}'s ludus claims the honor.`));
    if (myLeveledUp) log.push(`⚔ ${g.name} advances to level ${myNewLevel} — fully healed!`);

    await supabaseAdmin.from("gladiators").update({
      health: newHealth,
      health_updated_at: new Date().toISOString(),
      injury_until: injuryUntil,
      status: myDied ? "dead" : "idle",
      experience: myFinalXp,
      level: myNewLevel,
      wins: g.wins + (won ? 1 : 0),
      losses: g.losses + (won ? 0 : 1),
    }).eq("id", g.id);

    await supabaseAdmin.from("profiles").update({
      denarii: profile.denarii + denariiGained,
      reputation: Math.max(0, profile.reputation + repGained),
    }).eq("id", userId);

    // Update opposing (challenger) gladiator via admin (medicus/training/health already resolved above, before the fight sim)
    const oppDamage = Math.max(5, oppCurrentHealth - Math.max(0, oHp));
    const oppDied = toDeath && won;
    const oppXp = won ? 40 : 100;
    const oppNewXp = opp.experience + oppXp;
    const oppXpForNext = opp.level * 100;
    const oppLeveledUp = !oppDied && oppNewXp >= oppXpForNext;
    const oppNewLevel = oppLeveledUp ? opp.level + 1 : opp.level;
    const oppFinalXp = oppLeveledUp ? oppNewXp - oppXpForNext : oppNewXp;

    let oppNewHealth = Math.max(toDeath ? 0 : 1, oppCurrentHealth - oppDamage);
    let oppInjury: string | null = null;
    if (oppDied) {
      oppNewHealth = 0;
    } else if (oppLeveledUp) {
      oppNewHealth = oppMaxHp;
    } else if ((oppNewHealth <= 1 || oppDamage > oppMaxHp * 0.6) && oppNewHealth > 0) {
      const oppHours = injuryHours(rand(12, 24), opp.agility, oppMedicusLevel, oppTrainingLevel);
      oppInjury = new Date(Date.now() + oppHours * 3600_000).toISOString();
    }
    await supabaseAdmin.from("gladiators").update({
      health: oppNewHealth,
      health_updated_at: new Date().toISOString(),
      injury_until: oppInjury,
      status: oppDied ? "dead" : "idle",
      experience: oppFinalXp,
      level: oppNewLevel,
      wins: opp.wins + (won ? 0 : 1),
      losses: opp.losses + (won ? 1 : 0),
    }).eq("id", opp.id);

    const { data: oppProfile } = await supabaseAdmin.from("profiles").select("denarii,reputation,relics,boss_kills").eq("id", opp.owner_id).maybeSingle();
    if (oppProfile) {
      await supabaseAdmin.from("profiles").update({
        denarii: oppProfile.denarii + applyGoldBonus(won ? 30 : 150 * rewardMult, oppProfile.relics, oppProfile.boss_kills as Record<string, number>),
        reputation: Math.max(0, oppProfile.reputation + (won ? -1 : 6 * rewardMult)),
      }).eq("id", opp.owner_id);
    }

    // Resolve the challenge
    await supabaseAdmin.from("pvp_challenges").update({
      status: "resolved",
      opponent_id: userId,
      opponent_gladiator_id: g.id,
      winner_owner_id: won ? userId : opp.owner_id,
      log,
      resolved_at: new Date().toISOString(),
    }).eq("id", c.id);

    await supabase.from("matches").insert({
      owner_id: userId,
      gladiator_id: g.id,
      opponent_name: `${opp.name} (rival ludus)`,
      opponent_power: oppPower,
      difficulty: toDeath ? "pvp_death" : "pvp",
      result: won ? "win" : "loss",
      xp_gained: xpGained,
      denarii_gained: denariiGained,
      reputation_gained: repGained,
      log,
    });

    return {
      won, log, denariiGained, xpGained, repGained,
      died: myDied,
      fallen: myDied ? {
        id: g.id, name: g.name, class: g.class, weapon_type: g.weapon_type, is_beast: g.is_beast,
        level: g.level, wins: g.wins, losses: g.losses + 1,
        total_invested: g.total_invested ?? 0,
        honorCost: Math.max(10, Math.ceil((g.total_invested ?? 0) * 0.05)),
      } : null,
      rounds: fightRounds,
      myMaxHp,
      myStartHp: myCurrentHealth,
      oppMaxHp,
    };
  });


// ---------- HONOR FALLEN GLADIATOR ----------
export const honorGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    epitaph: z.string().max(200).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status !== "dead") throw new Error("Only fallen gladiators may be honored");

    const cost = Math.max(10, Math.ceil((g.total_invested ?? 0) * 0.05));

    await spendDenarii(supabaseAdmin, userId, cost, `A proper memorial costs ${cost} denarii`);

    const { error: insErr } = await supabaseAdmin.from("hall_of_fame").insert({
      owner_id: userId,
      name: g.name,
      class: g.class,
      weapon_type: g.weapon_type,
      is_beast: g.is_beast,
      level: g.level,
      wins: g.wins,
      losses: g.losses,
      total_invested: g.total_invested ?? 0,
      epitaph: data.epitaph ?? null,
    });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("gladiators").delete().eq("id", g.id);
    return { ok: true, cost };
  });





// ============================================================
// TEAM BATTLES — send multiple gladiators of specific composition
// ============================================================

export type TeamBattle = {
  key: string;
  label: string;
  flavor: string;
  size: number;
  requireClass?: string;         // every gladiator must be this class
  requireBeast?: number;         // exact number of beasts required
  reqFame: number;
  // Fixed opponent power band and HP pool — like the pit tiers, NOT scaled
  // to the sent cohort's own power. A weak cohort should be able to lose
  // here; only the boss fights self-scale (that's their whole point).
  powerMin: number;
  powerMax: number;
  hp: number;
  reward: number;
  xp: number;
  rep: number;
};

export const TEAM_BATTLES: TeamBattle[] = [
  { key: "duo", label: "Paired Combat", flavor: "Two gladiators face two condemned killers.", size: 2, reqFame: 5, powerMin: 150, powerMax: 400, hp: 150, reward: 400, xp: 120, rep: 6 },
  // All-beast encounters — requireBeast === size, so every slot must be a
  // beast. Beasts are rarer to come by than human recruits (see beastChance
  // in recruitGladiator), so these pay a real premium over the equivalent
  // human-only battle at a comparable power band.
  { key: "beast_duo", label: "Paired Beasts", flavor: "Two beasts of your ludus, loosed together against a chained bear.", size: 2, requireBeast: 2, reqFame: 8, powerMin: 150, powerMax: 400, hp: 150, reward: 600, xp: 150, rep: 8 },
  { key: "trio_murmillo", label: "Trio of Murmillones", flavor: "Three Murmillones in disciplined formation.", size: 3, requireClass: "Murmillo", reqFame: 20, powerMin: 400, powerMax: 800, hp: 220, reward: 900, xp: 200, rep: 14 },
  { key: "beast_hunt", label: "Grand Beast Hunt (Venatio)", flavor: "Two hunters and one beast against a Nubian panther.", size: 3, requireBeast: 1, reqFame: 30, powerMin: 500, powerMax: 950, hp: 260, reward: 1100, xp: 220, rep: 16 },
  { key: "cohort", label: "Rival Ludus Melee", flavor: "Four of your best against a rival cohort.", size: 4, reqFame: 80, powerMin: 1000, powerMax: 1700, hp: 340, reward: 1800, xp: 320, rep: 26 },
  { key: "grand_venatio", label: "The Emperor's Venatio", flavor: "Five beasts unleashed at once — a full venatio, the crowd's favorite spectacle.", size: 5, requireBeast: 5, reqFame: 150, powerMin: 1800, powerMax: 2600, hp: 400, reward: 2500, xp: 420, rep: 40 },
  { key: "spectacle", label: "Emperor's Spectacle", flavor: "Five champions in a grand spectacle. Legends are made here.", size: 5, reqFame: 250, powerMin: 2200, powerMax: 3400, hp: 480, reward: 3600, xp: 550, rep: 55 },
];

export function teamBattleRequirementError(
  battle: TeamBattle,
  gladiators: { class: string; is_beast: boolean; injury_until: string | null; health: number }[],
  ludusFame: number,
): string | null {
  if (ludusFame < battle.reqFame) return `Ludus needs ${battle.reqFame} fame`;
  if (gladiators.length !== battle.size) return `Choose exactly ${battle.size} gladiators`;
  if (gladiators.some(g => g.health < 30)) return "One gladiator is too wounded";
  if (gladiators.some(g => g.injury_until && new Date(g.injury_until) > new Date())) return "One gladiator is injured";
  if (battle.requireClass && gladiators.some(g => g.is_beast || g.class !== battle.requireClass)) {
    return `Every gladiator must be a ${battle.requireClass}`;
  }
  if (battle.requireBeast !== undefined) {
    const beasts = gladiators.filter(g => g.is_beast).length;
    if (beasts !== battle.requireBeast) return `Must include exactly ${battle.requireBeast} beast${battle.requireBeast === 1 ? "" : "s"}`;
  }
  return null;
}

const TEAM_KEYS = TEAM_BATTLES.map(t => t.key) as [string, ...string[]];
const TEAM_DIFFICULTY_KEYS = TEAM_BATTLES.map(t => `team:${t.key}`);

// Same charge system as pit fights (3 per gladiator, stamina-shortened 24h
// cooldown) but its own pool — a gladiator's team-battle charges are
// independent of their pit-fight charges. Every gladiator sent into a team
// battle spends one of their own, regardless of which battle size/type.
export const TEAM_MAX_CHARGES = 3;
export const TEAM_BASE_COOLDOWN_HOURS = 24;

export const getTeamBattleAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("training_level").eq("id", userId).maybeSingle();
    const trainingLevel = profile?.training_level ?? 1;
    const { data: gladiators } = await supabase.from("gladiators").select("id,stamina").eq("owner_id", userId);

    const windowStart = new Date(Date.now() - TEAM_BASE_COOLDOWN_HOURS * 3600_000).toISOString();
    const { data: recentFights } = await supabase
      .from("matches")
      .select("gladiator_id,created_at")
      .eq("owner_id", userId)
      .in("difficulty", TEAM_DIFFICULTY_KEYS)
      .eq("refunded_charge", false)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    const byGladiator = new Map<string, string[]>();
    for (const m of recentFights ?? []) {
      const list = byGladiator.get(m.gladiator_id) ?? [];
      list.push(m.created_at);
      byGladiator.set(m.gladiator_id, list);
    }

    const availability: Record<string, { chargesAvailable: number; nextAvailableAt: string | null; cooldownHours: number }> = {};
    for (const g of gladiators ?? []) {
      const cooldownHours = reflexCooldownHours(g.stamina, trainingLevel);
      const { chargesAvailable, nextAvailableAt } = chargeAvailability(byGladiator.get(g.id) ?? [], cooldownHours, TEAM_MAX_CHARGES);
      availability[g.id] = { chargesAvailable, nextAvailableAt, cooldownHours };
    }
    return { availability };
  });

export const fightTeamBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    battleKey: z.enum(TEAM_KEYS as unknown as [string, ...string[]]),
    gladiatorIds: z.array(z.string().uuid()).min(2).max(5),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const battle = TEAM_BATTLES.find(b => b.key === data.battleKey);
    if (!battle) throw new Error("Unknown battle");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");

    const { data: gs } = await supabase.from("gladiators").select("*").in("id", data.gladiatorIds).eq("owner_id", userId);
    const team = gs ?? [];
    const currentHealthById = new Map(team.map(g => [g.id, effectiveHealth(g, profile.medicus_level, profile.training_level)]));
    const err = teamBattleRequirementError(
      battle,
      team.map(g => ({ ...g, health: currentHealthById.get(g.id)! })),
      profile.reputation,
    );
    if (err) throw new Error(err);

    // Every gladiator sent spends one of their own team-battle charges —
    // checked per gladiator since a cohort can mix rested and cooling-down
    // fighters (fails on the first one found without a charge, mirroring
    // the pit fight's single-gladiator error message).
    const { data: recentTeamFights } = await supabase
      .from("matches")
      .select("gladiator_id,created_at")
      .in("gladiator_id", data.gladiatorIds)
      .in("difficulty", TEAM_DIFFICULTY_KEYS)
      .eq("refunded_charge", false)
      .gte("created_at", new Date(Date.now() - TEAM_BASE_COOLDOWN_HOURS * 3600_000).toISOString())
      .order("created_at", { ascending: false });
    const recentByGladiator = new Map<string, string[]>();
    for (const m of recentTeamFights ?? []) {
      const list = recentByGladiator.get(m.gladiator_id) ?? [];
      list.push(m.created_at);
      recentByGladiator.set(m.gladiator_id, list);
    }
    for (const g of team) {
      const cooldownHours = reflexCooldownHours(g.stamina, profile.training_level);
      const { chargesAvailable, nextAvailableAt } = chargeAvailability(recentByGladiator.get(g.id) ?? [], cooldownHours, TEAM_MAX_CHARGES);
      if (chargesAvailable <= 0 && nextAvailableAt) {
        const mins = Math.max(1, Math.ceil((new Date(nextAvailableAt).getTime() - Date.now()) / 60000));
        const hrs = Math.floor(mins / 60), rem = mins % 60;
        throw new Error(`${g.name} is resting — next team battle in ${hrs}h ${rem}m`);
      }
    }

    const { data: skills } = await supabase.from("ludus_skills").select("weapon_type,level").eq("owner_id", userId);
    const skillMap = new Map((skills ?? []).map(s => [s.weapon_type, s.level]));

    const teamPower = team.reduce((sum, g) => sum + gladiatorPower({ ...g, health: currentHealthById.get(g.id)! }, skillMap.get(g.weapon_type) ?? 0), 0);
    const enemyPower = rand(battle.powerMin, battle.powerMax);

    const defenseLevel = skillMap.get("defense") ?? 0;
    const defenseReduction = 1 - defenseLevel * 0.05;

    const log: string[] = [];
    log.push(`${battle.label} begins. ${team.map(t => t.name).join(", ")} enter the sand.`);
    log.push(`Team power ${teamPower} vs ${enemyPower}.`);
    if (defenseLevel > 0) log.push(`Defensive doctrine: rank ${defenseLevel} — the cohort shrugs off heavier blows.`);

    const teamChance = winChance(teamPower, enemyPower);
    log.push(`Cohort win chance per exchange: ${Math.round(teamChance * 100)}%.`);

    const teamMaxHp = team.reduce((sum, gl) => sum + maxHealth(gl.strength), 0);
    const teamCurrentHp = team.reduce((sum, gl) => sum + currentHealthById.get(gl.id)!, 0);
    const enemyMaxHp = battle.hp;
    // Start from the cohort's actual current pooled health, not a fresh full bar.
    let teamHp = teamCurrentHp;
    let enemyHp = enemyMaxHp;
    const fightRounds: FightRound[] = [];
    // Pooled team HP can run well past 1000 for large, high-strength
    // cohorts — same reasoning as the solo fights, cap must outlast it.
    for (let i = 1; i <= 20 && teamHp > 0 && enemyHp > 0; i++) {
      if (Math.random() < teamChance) {
        const d = rand(25, 45);
        enemyHp -= d;
        const text = `Round ${i}: your cohort presses for ${d}.`;
        log.push(text);
        // Team battles are never lethal — floor displayed HP at 1, not 0.
        fightRounds.push({ attacker: "me", damage: d, myHp: Math.max(1, teamHp), oppHp: Math.max(1, enemyHp), text });
      } else {
        const d = Math.max(5, Math.floor(rand(25, 45) * defenseReduction));
        teamHp -= d;
        const text = `Round ${i}: the enemy strikes for ${d}.`;
        log.push(text);
        fightRounds.push({ attacker: "opponent", damage: d, myHp: Math.max(1, teamHp), oppHp: Math.max(1, enemyHp), text });
      }
    }
    const won = enemyHp <= teamHp;

    const denariiGained = applyGoldBonus(
      won ? battle.reward + rand(0, Math.floor(battle.reward * 0.2)) : Math.floor(battle.reward * 0.15),
      profile.relics,
      profile.boss_kills as Record<string, number>,
    );
    const xpEach = Math.floor((won ? battle.xp : Math.floor(battle.xp * 0.4)) / team.length);
    const repGained = won ? battle.rep : 0;

    log.push(won
      ? `Victory! The cohort is showered with denarii and honor. +${denariiGained}d, +${repGained} fame.`
      : `The cohort is broken. Small purse of ${denariiGained}d for their courage.`);

    // Distribute damage across team members
    for (const g of team) {
      const shareDamage = Math.floor((teamCurrentHp - Math.max(0, teamHp)) / team.length) + rand(-5, 10);
      const dmg = Math.max(5, shareDamage);
      const newXp = g.experience + xpEach;
      const xpNext = g.level * 100;
      const leveledUp = newXp >= xpNext;
      const newLevel = leveledUp ? g.level + 1 : g.level;
      const finalXp = leveledUp ? newXp - xpNext : newXp;

      // Team battles are never lethal — floor at 1 HP, not 0.
      let newHealth = Math.max(1, currentHealthById.get(g.id)! - dmg);
      let injuryUntil: string | null = null;
      if (leveledUp) {
        newHealth = maxHealth(g.strength);
        log.push(`⚔ ${g.name} advances to level ${newLevel} — fully healed!`);
      } else if (newHealth <= 1 || dmg > maxHealth(g.strength) * 0.55) {
        const hours = injuryHours(rand(12, 24), g.agility, profile.medicus_level, profile.training_level);
        injuryUntil = new Date(Date.now() + hours * 3600_000).toISOString();
      }
      await supabaseAdmin.from("gladiators").update({
        health: newHealth,
        health_updated_at: new Date().toISOString(),
        injury_until: injuryUntil,
        experience: finalXp,
        level: newLevel,
        wins: g.wins + (won ? 1 : 0),
        losses: g.losses + (won ? 0 : 1),
      }).eq("id", g.id);
      await supabase.from("matches").insert({
        owner_id: userId,
        gladiator_id: g.id,
        opponent_name: battle.label,
        opponent_power: enemyPower,
        difficulty: `team:${battle.key}`,
        result: won ? "win" : "loss",
        xp_gained: xpEach,
        denarii_gained: Math.floor(denariiGained / team.length),
        reputation_gained: Math.floor(repGained / team.length),
        log,
      });
    }

    await supabaseAdmin.from("profiles").update({
      denarii: profile.denarii + denariiGained,
      reputation: profile.reputation + repGained,
    }).eq("id", userId);

    return { won, log, denariiGained, repGained, rounds: fightRounds, myMaxHp: teamMaxHp, myStartHp: teamCurrentHp, oppMaxHp: enemyMaxHp };
  });


// ============================================================
// BOSS FIGHTS — reflex-driven raids. See boss-encounters.ts for the
// telegraph/damage-scale content; this is the round-by-round state machine.
// ============================================================
const BOSS_KEYS = BOSS_ENCOUNTERS.map(b => b.key) as [string, ...string[]];
const GEAR_SLOT_KEYS = ["weapon_tier", "armor_tier", "helmet_tier", "legs_tier", "offhand_tier"] as const;
const GEAR_SLOT_LABELS: Record<string, string> = {
  weapon_tier: "weapon", armor_tier: "cuirass", helmet_tier: "helmet", legs_tier: "greaves", offhand_tier: "off-hand",
};

function computeTeamPowerAndHp(
  team: {
    strength: number; agility: number; stamina: number; technique: number;
    level: number; weapon_tier: number; armor_tier: number;
    helmet_tier?: number; legs_tier?: number; offhand_tier?: number;
    health: number; weapon_type: string;
  }[],
  skillMap: Map<string, number>,
) {
  const teamPower = team.reduce((sum, g) => sum + gladiatorPower(g, skillMap.get(g.weapon_type) ?? 0), 0);
  const teamMaxHp = team.reduce((sum, g) => sum + maxHealth(g.strength), 0);
  return { teamPower, teamMaxHp };
}

// Boss keys with at least one recorded win — used to gate encounters that
// unlock behind defeating an earlier boss (see BossUnlock in boss-encounters.ts).
async function fetchDefeatedBossKeys(supabase: SupabaseClient<Database>, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("boss_attempts").select("boss_key").eq("owner_id", userId).eq("won", true);
  return new Set((data ?? []).map(r => r.boss_key));
}

// ---- Cerberus round logic — see the mechanic comment on BossDefinition ----
// Each round is one attack in a burst; burst length is rolled once when the
// burst starts, from the zone matching the boss's CURRENT hp fraction (not
// fixed per-phase like the boar, since Cerberus has one continuous HP bar).
function cerberusZoneIndex(hpFraction: number): number {
  if (hpFraction > 0.67) return 0;
  if (hpFraction > 0.33) return 1;
  return 2;
}

function rollCerberusBurstLength(zoneIdx: number): number {
  if (zoneIdx === 0) return 2;
  if (zoneIdx === 1) return rand(3, 4);
  // Zone 2: starts at 3, then a decreasing chance (75%/55%/35%) to add one
  // more, up to 6.
  let n = 3;
  for (const chance of [0.75, 0.55, 0.35]) {
    if (Math.random() < chance) n++; else break;
  }
  return n;
}

// Which zones are safe to stand in for each head-lunge pattern — empty for
// "all_three" (unavoidable, matches the reference art of all three heads
// lunging at once).
const CERBERUS_LUNGE_SAFE_ZONES: Record<DogLungeVariant, ("left" | "center" | "right")[]> = {
  left_middle: ["right"],
  right_middle: ["left"],
  left_right: ["center"],
  middle_only: ["left", "right"],
  all_three: [],
};

// 20% snake bite; of the remaining 80% dog-lunge, 5% is "all_three" and the
// other 95% is split evenly across the four directional patterns — i.e.
// snake 20%, all_three 4%, each directional pattern 19%.
function rollCerberusAttack(): string {
  const r = Math.random();
  if (r < 0.20) return "snake_bite";
  if (r < 0.24) return "lunge:all_three";
  const variants: DogLungeVariant[] = ["left_middle", "right_middle", "middle_only", "left_right"];
  const idx = Math.min(3, Math.floor((r - 0.24) / 0.19));
  return `lunge:${variants[idx]}`;
}

export const getBossFightState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [sessionRes, attemptsRes, localWinRes] = await Promise.all([
      supabase.from("boss_fight_sessions").select("*").eq("owner_id", userId).maybeSingle(),
      supabase.from("boss_attempts").select("boss_key,created_at,won,loot_drops").eq("owner_id", userId).order("created_at", { ascending: false }),
      // Unbounded by the 20-row recent-matches list used elsewhere — a Local
      // Games win from long ago still counts, it just needs to have happened.
      supabase.from("matches").select("id").eq("owner_id", userId).eq("difficulty", "local").eq("result", "win").limit(1),
    ]);
    const latestByBoss = new Map<string, string>();
    const defeatedBosses = new Set<string>();
    const lootCounts: Record<string, Record<string, number>> = {};
    for (const row of attemptsRes.data ?? []) {
      if (!latestByBoss.has(row.boss_key)) latestByBoss.set(row.boss_key, row.created_at);
      if (row.won) defeatedBosses.add(row.boss_key);
      const counts = lootCounts[row.boss_key] ?? (lootCounts[row.boss_key] = {});
      for (const key of row.loot_drops ?? []) counts[key] = (counts[key] ?? 0) + 1;
    }
    const cooldowns: Record<string, string | null> = {};
    const defeated: Record<string, boolean> = {};
    for (const boss of BOSS_ENCOUNTERS) {
      const last = latestByBoss.get(boss.key);
      if (!last) { cooldowns[boss.key] = null; } else {
        const availableAt = new Date(new Date(last).getTime() + 24 * 3600_000);
        cooldowns[boss.key] = availableAt > new Date() ? availableAt.toISOString() : null;
      }
      defeated[boss.key] = defeatedBosses.has(boss.key);
    }
    return { session: sessionRes.data, cooldowns, hasWonLocal: (localWinRes.data ?? []).length > 0, defeated, lootCounts };
  });

// Fixed, learnable per-phase rhythm: strike window, boar attack, strike
// window, boar special (howl) attack, then repeats — replaces an earlier
// version that rolled an independent random beat every round, which let
// players just mash Strike whenever that round's label happened to say so.
// `round` is 1-indexed and resets to 1 at the start of each phase.
type BossBeat = "vulnerable" | "defensive" | "howl" | "net_bonus" | "snake_bite" | `lunge:${DogLungeVariant}`;
function bossBeatForRound(round: number): BossBeat {
  const pos = (round - 1) % 4;
  return pos === 1 ? "defensive" : pos === 3 ? "howl" : "vulnerable";
}

// The howl beat's reaction window is shorter than a normal round's, on top
// of hitting harder — see BossPhase.howlDamageScale. Cerberus's snake bite
// gets the same tighter window.
const HOWL_DEADLINE_MULT = 0.7;
function bossRoundDeadlineMs(boss: BossDefinition, beat: BossBeat): number {
  return (beat === "howl" || beat === "snake_bite") ? Math.round(boss.roundDeadlineMs * HOWL_DEADLINE_MULT) : boss.roundDeadlineMs;
}

// After a round resolves, the client plays a two-stage reveal — the
// player's own roll, then the boar's passive mauling — before the next
// beat's prompt opens. The next round's deadline is pushed back by this
// much so the reveal doesn't eat into the player's actual reaction window
// (see roundStartedAt reconstruction below, which cancels this back out).
export const BOSS_PLAYER_REVEAL_MS = 2000;
export const BOSS_BOAR_REVEAL_MS = 2000;
const BOSS_REVEAL_TOTAL_MS = BOSS_PLAYER_REVEAL_MS + BOSS_BOAR_REVEAL_MS;

export type BossRoundOutcome = {
  beat: BossBeat;
  playerLabel: string;
  playerDamage: number;
  playerTarget: "boss" | "party";
  tickDamage: number;
};

export const startBossFight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    bossKey: z.enum(BOSS_KEYS),
    gladiatorIds: z.array(z.string().uuid()),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const boss = BOSS_ENCOUNTERS.find(b => b.key === data.bossKey);
    if (!boss) throw new Error("Unknown boss");

    // Only one session can exist per player (unique index on owner_id) — if
    // one is already in flight (e.g. a page refresh mid-fight), hand it back
    // instead of erroring or starting a second one.
    const { data: existingSession } = await supabase.from("boss_fight_sessions").select("*").eq("owner_id", userId).maybeSingle();
    if (existingSession) return { done: false as const, session: existingSession };

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");

    const { data: lastAttempt } = await supabase.from("boss_attempts")
      .select("created_at").eq("owner_id", userId).eq("boss_key", boss.key)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (lastAttempt) {
      const availableAt = new Date(lastAttempt.created_at).getTime() + 24 * 3600_000;
      if (Date.now() < availableAt) {
        throw new Error(`${boss.name} is not ready — recovers in ${Math.ceil((availableAt - Date.now()) / 3_600_000)}h`);
      }
    }

    const [{ data: localWin }, defeatedBossKeys] = await Promise.all([
      supabase.from("matches").select("id")
        .eq("owner_id", userId).eq("difficulty", "local").eq("result", "win").limit(1),
      fetchDefeatedBossKeys(supabase, userId),
    ]);
    const { data: gs } = await supabase.from("gladiators").select("*").in("id", data.gladiatorIds).eq("owner_id", userId);
    const team = gs ?? [];
    const currentHealthById = new Map(team.map(g => [g.id, effectiveHealth(g, profile.medicus_level, profile.training_level)]));
    const withCurrentHealth = team.map(g => ({ ...g, health: currentHealthById.get(g.id)! }));
    const err = bossRequirementError(boss, withCurrentHealth, { hasWonLocalGames: (localWin ?? []).length > 0, defeatedBossKeys });
    if (err) throw new Error(err);

    const { data: skills } = await supabase.from("ludus_skills").select("weapon_type,level").eq("owner_id", userId);
    const skillMap = new Map((skills ?? []).map(s => [s.weapon_type, s.level]));
    const { teamPower, teamMaxHp } = computeTeamPowerAndHp(withCurrentHealth, skillMap);

    const phase1 = boss.phases[0];
    const bossMaxHp = Math.max(1, Math.round(teamPower * phase1.hpScale));
    const log = [`${team.map(g => g.name).join(", ")} face ${boss.name}. ${boss.flavor}`];

    let beatType: BossBeat;
    let burstLength = 0;
    let burstIndex = 0;
    if (boss.mechanic === "cerberus") {
      burstLength = rollCerberusBurstLength(0);
      burstIndex = 1;
      beatType = rollCerberusAttack() as BossBeat;
    } else {
      const hasNet = team.some(g => g.weapon_type === "net");
      beatType = phase1.netBonus && hasNet ? "net_bonus" : bossBeatForRound(1);
    }

    // Shield-bearers (weapon_type "gladius") must block a charge, everyone
    // else must dodge — frozen at fight start so a mid-fight gear change
    // can't retroactively flip who owes which reflex. Armor reduction for
    // the boss's passive per-second mauling is frozen the same way.
    const shieldMap: Record<string, boolean> = Object.fromEntries(team.map(g => [g.id, g.weapon_type === "gladius"]));
    const defenseLevel = skillMap.get("defense") ?? 0;
    const armorReduction = team.length
      ? Math.round(team.reduce((sum, g) => sum + armorMitigation(g, defenseLevel).min, 0) / team.length)
      : 0;

    const { data: session, error } = await supabaseAdmin.from("boss_fight_sessions").insert({
      owner_id: userId,
      boss_key: boss.key,
      gladiator_ids: data.gladiatorIds,
      gladiator_names: team.map(g => g.name),
      shield_map: shieldMap,
      armor_reduction: armorReduction,
      phase: 1,
      team_power: teamPower,
      boss_hp: bossMaxHp,
      boss_max_hp: bossMaxHp,
      party_hp: teamMaxHp,
      party_max_hp: teamMaxHp,
      round: 1,
      burst_length: burstLength,
      burst_index: burstIndex,
      beat_type: beatType,
      round_deadline: new Date(Date.now() + bossRoundDeadlineMs(boss, beatType)).toISOString(),
      log,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return { done: false as const, session };
  });

export const resolveBossRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    action: z.enum(["strike", "hold"]).optional(),
    defenses: z.record(z.string(), z.enum(["block", "dodge"])).optional(),
    zone: z.enum(["left", "center", "right"]).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabase.from("boss_fight_sessions").select("*").eq("owner_id", userId).maybeSingle();
    if (!session) throw new Error("No boss fight in progress");

    const boss = BOSS_ENCOUNTERS.find(b => b.key === session.boss_key);
    if (!boss) throw new Error("Unknown boss");
    // Cerberus has one continuous HP bar — its "phase" is really an
    // attack-intensity zone re-derived from the CURRENT hp fraction every
    // round, not a slot that only advances when the boar-style phase-reset
    // block below fires.
    const isCerberus = boss.mechanic === "cerberus";
    const zoneIdx = isCerberus
      ? cerberusZoneIndex(session.boss_max_hp > 0 ? session.boss_hp / session.boss_max_hp : 0)
      : session.phase - 1;
    const phaseDef = boss.phases[zoneIdx];

    // The server owns the round's deadline — a request arriving after it
    // (slow client, dropped connection, tab left open) always resolves as
    // the worst case for whatever beat is live, regardless of what the
    // client actually submitted.
    const late = Date.now() > new Date(session.round_deadline).getTime();
    const action: "strike" | "hold" = late ? "hold" : (data.action ?? "hold");

    const log: string[] = Array.isArray(session.log) ? [...(session.log as string[])] : [];
    let bossHp = session.boss_hp;
    let partyHp = session.party_hp;

    // Populated by whichever branch below runs, then handed back to the
    // client as roundOutcome so it can play a two-stage reveal (this round's
    // own result, then the boar's passive mauling) instead of jumping
    // straight to the next beat's prompt.
    let playerLabel = "";
    let playerDamage = 0;
    let playerTarget: "boss" | "party" = "boss";

    if (session.beat_type === "net_bonus") {
      if (action === "strike") {
        const dmg = Math.round(session.team_power * (phaseDef.netBonusDamageScale ?? 0));
        bossHp -= dmg;
        log.push(`Round ${session.round}: the net snares ${boss.name} — a clean opening for ${dmg}.`);
        playerLabel = "The net snares it!"; playerDamage = dmg; playerTarget = "boss";
      } else {
        log.push(`Round ${session.round}: the net goes unused.`);
        playerLabel = "The net goes unused."; playerDamage = 0; playerTarget = "boss";
      }
    } else if (session.beat_type === "vulnerable") {
      if (action === "strike") {
        const dmg = Math.round(session.team_power * phaseDef.vulnerableDamageScale);
        bossHp -= dmg;
        log.push(`Round ${session.round}: ${boss.name} is exposed — you strike for ${dmg}.`);
        playerLabel = "You strike!"; playerDamage = dmg; playerTarget = "boss";
      } else {
        log.push(`Round ${session.round}: an opening comes and goes.`);
        playerLabel = "An opening comes and goes."; playerDamage = 0; playerTarget = "boss";
      }
    } else if (typeof session.beat_type === "string" && session.beat_type.startsWith("lunge:")) {
      // Cerberus head-lunge — the whole cohort moves together to one of
      // three zones (no per-gladiator choice, unlike the block/dodge call
      // below), so a single "the player" input decides it.
      const variant = session.beat_type.slice("lunge:".length) as DogLungeVariant;
      const safeZones = CERBERUS_LUNGE_SAFE_ZONES[variant] ?? [];
      const picked = late ? undefined : data.zone;
      const dodged = !!picked && safeZones.includes(picked);
      const variantLabel = variant.replace(/_/g, " ");
      if (dodged) {
        log.push(`Round ${session.round}: the ${variantLabel} lunge misses — the cohort reads it clean.`);
        playerLabel = "Clean read!"; playerDamage = 0; playerTarget = "party";
      } else {
        const dmg = Math.round(session.party_max_hp * phaseDef.defensiveDamageScale);
        partyHp -= dmg;
        const why = safeZones.length === 0 ? "all three heads lunge at once — nowhere to go"
          : picked ? "the cohort moves the wrong way" : "the cohort hesitates";
        log.push(`Round ${session.round}: ${why} — ${dmg} damage taken.`);
        playerLabel = safeZones.length === 0 ? "No way to dodge!" : "Caught by the lunge!"; playerDamage = dmg; playerTarget = "party";
      }
    } else {
      // Defensive/howl beat (the boar) or snake_bite (Cerberus) — every
      // gladiator must individually block (if they carry a shield) or dodge
      // (if they don't). A late/missing response counts as failed for that
      // gladiator, same "worst case" rule as every other timeout in this
      // fight. One gap in the line is enough through — a single failure
      // costs the whole party, this isn't graduated by how many got it wrong.
      const isSnake = session.beat_type === "snake_bite";
      const isHowl = session.beat_type === "howl";
      const failDamageScale = (isHowl || isSnake) ? phaseDef.howlDamageScale : phaseDef.defensiveDamageScale;
      const shieldMap = (session.shield_map ?? {}) as Record<string, boolean>;
      const names = session.gladiator_names ?? [];
      const defenses: Record<string, string> = late ? {} : (data.defenses ?? {});
      let failedCount = 0;
      const beats: string[] = [];
      const allShieldParty = session.gladiator_ids.every(id => shieldMap[id]);
      session.gladiator_ids.forEach((id, i) => {
        const correct = shieldMap[id] ? "block" : "dodge";
        const picked = defenses[id];
        const name = names[i] ?? "A gladiator";
        if (picked === correct) {
          beats.push(`${name} ${correct === "block" ? "blocks" : "dodges"} clean`);
        } else {
          failedCount++;
          beats.push(picked ? `${name} ${picked === "block" ? "blocks" : "dodges"} the wrong way` : `${name} hesitates`);
        }
      });
      if (failedCount > 0) {
        const dmg = Math.round(session.party_max_hp * failDamageScale);
        partyHp -= dmg;
        const breakText = isSnake ? "the serpent strikes true" : isHowl ? "the howl shatters the line" : "the line breaks";
        log.push(`Round ${session.round}: ${beats.join("; ")} — ${breakText}, ${dmg} damage taken.`);
        playerLabel = isSnake ? "The serpent strikes!" : isHowl ? "The howl shatters the line!" : "The line breaks!"; playerDamage = dmg; playerTarget = "party";
      } else if (allShieldParty) {
        // Shieldwall — a full line of shields, all blocking clean, punches
        // back with a critical counter instead of just weathering the hit.
        const dmg = Math.round(session.team_power * phaseDef.vulnerableDamageScale * boss.shieldwallCritMult);
        bossHp -= dmg;
        log.push(`Round ${session.round}: ${beats.join("; ")} — Shieldwall! The cohort counters as one, a critical strike for ${dmg}.`);
        playerLabel = "Shieldwall!"; playerDamage = dmg; playerTarget = "boss";
      } else {
        log.push(`Round ${session.round}: ${beats.join("; ")} — no damage taken.`);
        playerLabel = "The line holds."; playerDamage = 0; playerTarget = "party";
      }
    }

    // The boar keeps mauling passively every second, regardless of the
    // round's beat — reduced by the party's frozen average armor
    // mitigation, floored so armor can blunt it but never fully negate it.
    // Cerberus has no passive tick — its difficulty comes purely from
    // surviving longer attack bursts, not a mauling clock.
    let tickDamage = 0;
    if (!isCerberus) {
      const thisRoundMs = bossRoundDeadlineMs(boss, session.beat_type as BossBeat);
      const roundStartedAt = new Date(session.round_deadline).getTime() - thisRoundMs;
      const elapsedMs = Math.min(thisRoundMs, Math.max(0, Date.now() - roundStartedAt));
      const tickPerSecond = Math.max(1, Math.round(session.party_max_hp * phaseDef.tickDamageScale) - session.armor_reduction);
      tickDamage = Math.round(tickPerSecond * (elapsedMs / 1000));
      if (tickDamage > 0) {
        partyHp -= tickDamage;
        log.push(`${boss.name}'s constant mauling costs ${tickDamage} more.`);
      }
    }

    const roundOutcome: BossRoundOutcome = {
      beat: session.beat_type as BossBeat,
      playerLabel, playerDamage, playerTarget,
      tickDamage,
    };

    bossHp = Math.max(0, bossHp);
    const partyDefeated = partyHp <= 1;
    partyHp = Math.max(1, partyHp);

    const XP_PER_GLADIATOR = 200;

    const finish = async (won: boolean) => {
      const { data: gs } = await supabase.from("gladiators").select("*").in("id", session.gladiator_ids).eq("owner_id", userId);
      const team = gs ?? [];
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      const medicusLevel = profile?.medicus_level ?? 1;
      const trainingLevel = profile?.training_level ?? 1;
      const ownedRelics = profile?.relics ?? [];
      const relicsLevel = profile?.relics_level ?? 1;
      const bossKills = { ...(profile?.boss_kills as Record<string, number> ?? {}) };
      if (won) bossKills[boss.key] = (bossKills[boss.key] ?? 0) + 1;

      const damageTaken = session.party_max_hp - partyHp;
      let denariiGained = 0;
      let hadesKeysGained = 0;
      const gearNotes: string[] = [];
      const lootDrops: string[] = [];
      const newRelics: string[] = [];
      const denariiItem = boss.lootTable.find((i): i is Extract<LootItem, { effect: "denarii" }> => i.effect === "denarii");
      const gearItem = boss.lootTable.find((i): i is Extract<LootItem, { effect: "gear" }> => i.effect === "gear");
      const trinketItems = boss.lootTable.filter((i): i is Extract<LootItem, { effect: "trinket" }> => i.effect === "trinket");
      const keyItems = boss.lootTable.filter((i): i is Extract<LootItem, { effect: "key" }> => i.effect === "key");

      // Group-level rewards roll once per fight, not per gladiator — only
      // "gear" is an individual roll, below. Trinkets are unique: the roll
      // is skipped once the ludus already owns that relic. Keys are a
      // stackable consumable, rolled against the Temple of Relics' level.
      if (won) {
        if (denariiItem && Math.random() < denariiItem.chance) {
          lootDrops.push(denariiItem.key);
          denariiGained += rand(denariiItem.min, denariiItem.max);
        }
        for (const item of trinketItems) {
          if (ownedRelics.includes(item.relicKey) || newRelics.includes(item.relicKey)) continue;
          if (Math.random() < item.chance) {
            lootDrops.push(item.key);
            newRelics.push(item.relicKey);
          }
        }
        for (const item of keyItems) {
          if (Math.random() < keyDropChance(relicsLevel)) {
            lootDrops.push(item.key);
            hadesKeysGained += 1;
          }
        }
      }

      // Flat 200 XP per gladiator on a win — but a costly win still costs
      // you: losing a third of the party's pooled health forfeits XP for
      // the last-picked gladiator, two-thirds forfeits it for the last two.
      // A loss already grants none (the whole party effectively "wiped").
      const damageFraction = session.party_max_hp > 0 ? damageTaken / session.party_max_hp : 0;
      const xpIneligibleCount = damageFraction >= 2 / 3 ? 2 : damageFraction >= 1 / 3 ? 1 : 0;
      const xpIneligibleIds = new Set(xpIneligibleCount > 0 ? session.gladiator_ids.slice(-xpIneligibleCount) : []);
      const xpNotes: string[] = [];
      const xpByGladiator = new Map<string, number>();

      for (const g of team) {
        const shareDamage = Math.floor(damageTaken / team.length) + rand(-5, 10);
        const dmg = Math.max(1, shareDamage);
        const currentHealth = effectiveHealth(g, medicusLevel, trainingLevel);

        let newXp = g.experience;
        let newLevel = g.level;
        let leveledUp = false;
        const gladXp = won && !xpIneligibleIds.has(g.id) ? XP_PER_GLADIATOR : 0;
        xpByGladiator.set(g.id, gladXp);
        if (gladXp > 0) {
          newXp += gladXp;
          const xpForNext = newLevel * 100;
          if (newXp >= xpForNext) { newXp -= xpForNext; newLevel += 1; leveledUp = true; }
        } else if (won) {
          xpNotes.push(`${g.name} is too battered to profit from the win — no XP.`);
        }

        let newHealth = Math.max(1, currentHealth - dmg);
        let injuryUntil: string | null = null;
        if (leveledUp) {
          newHealth = maxHealth(g.strength);
          xpNotes.push(`${g.name} advances to level ${newLevel} — fully healed!`);
        } else if (newHealth <= 1 || dmg > maxHealth(g.strength) * 0.55) {
          const hours = injuryHours(rand(12, 24), g.agility, medicusLevel, trainingLevel);
          injuryUntil = new Date(Date.now() + hours * 3600_000).toISOString();
        }

        const patch: Record<string, unknown> = {
          health: newHealth,
          health_updated_at: new Date().toISOString(),
          injury_until: injuryUntil,
          wins: g.wins + (won ? 1 : 0),
          losses: g.losses + (won ? 0 : 1),
          experience: newXp,
          level: newLevel,
        };

        if (won && gearItem && Math.random() < gearItem.chance) {
          lootDrops.push(gearItem.key);
          const row = g as unknown as Record<string, number>;
          const options = GEAR_SLOT_KEYS.filter(k => (row[k] ?? 0) < MAX_GEAR_TIER);
          if (options.length > 0) {
            const slot = options[Math.floor(Math.random() * options.length)];
            patch[slot] = row[slot] + 1;
            gearNotes.push(`${g.name}: +1 ${GEAR_SLOT_LABELS[slot]}`);
          } else {
            const consolation = Math.max(1, Math.round(50 * (0.85 + Math.random() * 0.3)));
            denariiGained += consolation;
            gearNotes.push(`${g.name}: already mastercrafted — +${consolation} denarii instead`);
          }
        }

        const { error: updateErr } = await supabaseAdmin.from("gladiators").update(patch as never).eq("id", g.id);
        if (updateErr) throw new Error(updateErr.message);
      }

      if (!won && denariiItem) {
        denariiGained += Math.floor(((denariiItem.min + denariiItem.max) / 2) * 0.15);
      }
      const allRelics = [...ownedRelics, ...newRelics];
      denariiGained = applyGoldBonus(denariiGained, allRelics, bossKills);
      const totalXpGained = [...xpByGladiator.values()].reduce((a, b) => a + b, 0);

      const relicNotes = newRelics.map(k => RELICS.find(r => r.key === k)?.label ?? k);
      const keyNote = hadesKeysGained > 0 ? "the cohort recovers a Key to Hades!" : "";
      log.push(won
        ? `${boss.name} falls. +${denariiGained} denarii.${totalXpGained > 0 ? ` +${XP_PER_GLADIATOR} XP each.` : ""}${gearNotes.length ? " " + gearNotes.join(", ") : ""}${xpNotes.length ? " " + xpNotes.join(" ") : ""}${relicNotes.length ? ` The cohort discovers ${relicNotes.join(", ")}!` : ""}${keyNote ? ` ${keyNote}` : ""}`
        : `The cohort is broken and falls back. A small purse of ${denariiGained} denarii for their courage.`);

      if (profile) {
        await supabaseAdmin.from("profiles").update({
          denarii: profile.denarii + denariiGained,
          relics: allRelics,
          boss_kills: bossKills,
          hades_keys: (profile.hades_keys ?? 0) + hadesKeysGained,
        }).eq("id", userId);
      }

      for (const g of team) {
        await supabase.from("matches").insert({
          owner_id: userId,
          gladiator_id: g.id,
          opponent_name: boss.name,
          opponent_power: session.boss_max_hp,
          difficulty: `boss:${boss.key}`,
          result: won ? "win" : "loss",
          xp_gained: xpByGladiator.get(g.id) ?? 0,
          denarii_gained: Math.floor(denariiGained / team.length),
          reputation_gained: 0,
          log,
        });
      }

      await supabaseAdmin.from("boss_attempts").insert({
        owner_id: userId,
        boss_key: boss.key,
        gladiator_ids: session.gladiator_ids,
        won,
        denarii_gained: denariiGained,
        xp_gained: totalXpGained,
        reputation_gained: 0,
        loot_drops: lootDrops,
        log,
      });
      await supabaseAdmin.from("boss_fight_sessions").delete().eq("owner_id", userId);

      return { done: true as const, won, log, denariiGained, repGained: 0 };
    };

    if (bossHp <= 0) {
      // Cerberus is one continuous HP bar — reaching 0 always ends the
      // fight, regardless of which attack-intensity zone it happened in.
      // Only the boar's separate reset-on-transition phase pools advance.
      if (!isCerberus && session.phase < boss.phases.length) {
        const nextPhaseDef = boss.phases[session.phase];
        const nextBossMaxHp = Math.max(1, Math.round(session.team_power * nextPhaseDef.hpScale));
        const { data: gs } = await supabase.from("gladiators").select("weapon_type").in("id", session.gladiator_ids);
        const hasNet = (gs ?? []).some(g => g.weapon_type === "net");
        const nextBeat: BossBeat = nextPhaseDef.netBonus && hasNet ? "net_bonus" : bossBeatForRound(1);
        log.push(`Phase ${session.phase + 1}: ${boss.name} presses on.`);
        const { data: updated, error } = await supabaseAdmin.from("boss_fight_sessions").update({
          phase: session.phase + 1,
          boss_hp: nextBossMaxHp,
          boss_max_hp: nextBossMaxHp,
          party_hp: partyHp,
          round: 1,
          beat_type: nextBeat,
          round_deadline: new Date(Date.now() + BOSS_REVEAL_TOTAL_MS + bossRoundDeadlineMs(boss, nextBeat)).toISOString(),
          log,
        }).eq("owner_id", userId).select("*").single();
        if (error) throw new Error(error.message);
        return { done: false as const, session: updated, roundOutcome };
      }
      return { ...(await finish(true)), roundOutcome };
    }

    if (partyDefeated) return { ...(await finish(false)), roundOutcome };

    if (session.round >= boss.maxRoundsPerPhase) return { ...(await finish(false)), roundOutcome };

    let nextBeat: BossBeat;
    let nextPhase = session.phase;
    let nextBurstLength = session.burst_length;
    let nextBurstIndex = session.burst_index;
    if (isCerberus) {
      if (session.beat_type === "vulnerable") {
        // Strike window just resolved (hit or miss) — start a fresh burst
        // from whichever zone the boss's CURRENT hp now falls in.
        const newZoneIdx = cerberusZoneIndex(bossHp / session.boss_max_hp);
        nextPhase = newZoneIdx + 1;
        nextBurstLength = rollCerberusBurstLength(newZoneIdx);
        nextBurstIndex = 1;
        nextBeat = rollCerberusAttack() as BossBeat;
      } else if (session.burst_index >= session.burst_length) {
        // Burst complete — open the strike window.
        nextBeat = "vulnerable";
      } else {
        // Mid-burst — bossHp is untouched by lunge/snake beats, so the zone
        // can't have shifted; roll the next attack in the same burst.
        nextBurstIndex = session.burst_index + 1;
        nextBeat = rollCerberusAttack() as BossBeat;
        nextPhase = zoneIdx + 1;
      }
    } else {
      nextBeat = bossBeatForRound(session.round + 1);
    }

    const { data: updated, error } = await supabaseAdmin.from("boss_fight_sessions").update({
      boss_hp: bossHp,
      party_hp: partyHp,
      round: session.round + 1,
      phase: nextPhase,
      burst_length: nextBurstLength,
      burst_index: nextBurstIndex,
      beat_type: nextBeat,
      round_deadline: new Date(Date.now() + BOSS_REVEAL_TOTAL_MS + bossRoundDeadlineMs(boss, nextBeat)).toISOString(),
      log,
    }).eq("owner_id", userId).select("*").single();
    if (error) throw new Error(error.message);
    return { done: false as const, session: updated, roundOutcome };
  });


// ============================================================
// GLOBAL LEADERBOARDS — fame across all ludi and gladiators
// ============================================================
export const getLeaderboards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [ludi, glads] = await Promise.all([
      supabase.rpc("get_reputation_leaderboard", { p_limit: 25 }),
      supabase.from("gladiators")
        .select("id,owner_id,name,class,weapon_type,is_beast,level,wins,losses,status,best_rank")
        .neq("status", "dead")
        .order("wins", { ascending: false })
        .order("level", { ascending: false })
        .limit(25),
    ]);

    // Persist best_rank (lower is better) for anyone whose current rank beats their stored best.
    const ludiRows = ludi.data ?? [];
    const gladRows = glads.data ?? [];
    await Promise.all([
      ...ludiRows.map((p, i) => {
        const rank = i + 1;
        if (p.best_rank == null || rank < p.best_rank) {
          return supabaseAdmin.from("profiles").update({ best_rank: rank } as never).eq("id", p.id);
        }
        return Promise.resolve();
      }),
      ...gladRows.map((g, i) => {
        const rank = i + 1;
        if (g.best_rank == null || rank < g.best_rank) {
          return supabaseAdmin.from("gladiators").update({ best_rank: rank } as never).eq("id", g.id);
        }
        return Promise.resolve();
      }),
    ]);

    const ownerIds = [...new Set(gladRows.map(g => g.owner_id))];
    const { data: owners } = ownerIds.length
      ? await supabase.rpc("get_pvp_profiles", { p_ids: ownerIds })
      : { data: [] as { id: string; ludus_name: string }[] };
    const ownerMap = new Map((owners ?? []).map(o => [o.id, o.ludus_name]));
    return {
      ludi: ludiRows.map((p, i) => ({ rank: i + 1, ...p, best_rank: Math.min(i + 1, p.best_rank ?? i + 1) })),
      gladiators: gladRows.map((g, i) => ({
        rank: i + 1,
        ...g,
        best_rank: Math.min(i + 1, g.best_rank ?? i + 1),
        ludus_name: ownerMap.get(g.owner_id) ?? "Unknown Ludus",
      })),
    };
  });

// ============================================================
// PUBLIC LUDUS PROFILE — visit another ludus
// ============================================================
export const updateLudusDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { description: string }) =>
    z.object({ description: z.string().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ description: data.description } as never)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateLudusProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    ludus_name?: string;
    description?: string;
    bio?: string;
    showcase_limit?: number;
    showcase_gladiator_ids?: string[];
  }) =>
    z.object({
      ludus_name: z.string().trim().min(3).max(40).optional(),
      description: z.string().max(500).optional(),
      bio: z.string().max(1500).optional(),
      showcase_limit: z.number().int().min(1).max(12).optional(),
      showcase_gladiator_ids: z.array(z.string().uuid()).max(12).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.ludus_name !== undefined) patch.ludus_name = data.ludus_name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.showcase_limit !== undefined) patch.showcase_limit = data.showcase_limit;
    if (data.showcase_gladiator_ids !== undefined) patch.showcase_gladiator_ids = data.showcase_gladiator_ids;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("profiles")
      .update(patch as never).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyLudusRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles")
      .select("id,ludus_name,description,bio,showcase_limit,showcase_gladiator_ids")
      .eq("id", userId).maybeSingle();
    const { data: glads } = await supabase.from("gladiators")
      .select("id,name,class,weapon_type,is_beast,level,wins,losses,status")
      .eq("owner_id", userId)
      .neq("status", "dead")
      .order("level", { ascending: false });
    return { profile, roster: glads ?? [] };
  });

export const getPublicLudus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profiles, error } = await supabase.rpc("get_pvp_profiles", { p_ids: [data.id] });
    if (error) throw new Error(error.message);
    const profile = profiles?.[0] ?? null;
    if (!profile) throw new Error("Ludus not found");

    const p = profile as typeof profile & {
      bio: string;
      showcase_limit: number;
      showcase_gladiator_ids: string[];
    };
    const limit = Math.max(1, Math.min(12, p.showcase_limit ?? 8));
    const picks = (p.showcase_gladiator_ids ?? []).slice(0, limit);

    const { count: rosterCount } = await supabase.from("gladiators")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", data.id)
      .neq("status", "dead");

    type ShowcaseGlad = {
      id: string; name: string; class: string; weapon_type: string;
      is_beast: boolean; level: number; wins: number; losses: number;
      status: string; best_rank: number | null;
      strength: number; agility: number; stamina: number; technique: number;
      origin: string;
    };
    let showcase: ShowcaseGlad[] = [];
    if (picks.length > 0) {
      const { data: glads } = await supabase.from("gladiators")
        .select("id,name,class,weapon_type,is_beast,level,wins,losses,status,best_rank,strength,agility,stamina,technique,origin")
        .in("id", picks)
        .neq("status", "dead");
      const order = new Map(picks.map((id, i) => [id, i]));
      showcase = ((glads ?? []) as unknown as ShowcaseGlad[]).slice()
        .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
    } else {
      const { data: glads } = await supabase.from("gladiators")
        .select("id,name,class,weapon_type,is_beast,level,wins,losses,status,best_rank,strength,agility,stamina,technique,origin")
        .eq("owner_id", data.id)
        .neq("status", "dead")
        .order("wins", { ascending: false })
        .order("level", { ascending: false })
        .limit(limit);
      showcase = (glads ?? []) as unknown as ShowcaseGlad[];
    }

    return {
      profile: p,
      showcase,
      roster_count: rosterCount ?? 0,
    };
  });

// ============================================================
// ACHIEVEMENTS — badges with 5 tiers each. Purely derived from existing
// tables (profiles/gladiators/hall_of_fame/matches); no dedicated table, so
// "recruited" and "level reached" are best-effort from what's still on
// record (a dismissed-without-honor gladiator's history isn't preserved).
// ============================================================
export type AchievementCategory = {
  key: string;
  label: string;
  description: string;
  tiers: [number, number, number, number, number]; // first 4 linear, 5th a longer grind
};

export const ACHIEVEMENTS: AchievementCategory[] = [
  {
    key: "level", label: "Champion of the Sands",
    description: "Train a single gladiator to reach these levels.",
    tiers: [5, 10, 15, 20, 30],
  },
  {
    key: "wins", label: "Blood and Sand",
    description: "Win this many bouts combined, across the pits, rival ludi, and cohort battles.",
    tiers: [10, 20, 50, 100, 250],
  },
  {
    key: "pvpWins", label: "Rival of Ludi",
    description: "Defeat rival champions in the arena this many times.",
    tiers: [5, 10, 15, 20, 50],
  },
  {
    key: "deathWins", label: "We who are about to die, salute you",
    description: "Win this many sine missione — fights to the death.",
    tiers: [1, 2, 5, 10, 25],
  },
  {
    key: "facilities", label: "Master of the Ludus",
    description: "Raise the combined level of all five facilities to this total (30 is every facility maxed, including a fully-trained Training Yard).",
    tiers: [5, 10, 15, 20, 30],
  },
  {
    key: "reputation", label: "Renown of Rome",
    description: "Grow your ludus's fame to this level.",
    tiers: [50, 100, 250, 1000, 2500],
  },
  {
    key: "denarii", label: "Coffers of the Ludus",
    description: "Hold this many denarii at once.",
    tiers: [1000, 2000, 3000, 4000, 10000],
  },
  {
    key: "recruits", label: "Lanista's Eye",
    description: "Recruit this many gladiators over your ludus's history.",
    tiers: [5, 10, 15, 20, 40],
  },
  {
    key: "beasts", label: "Beast Master",
    description: "Keep this many beasts in your pantry at once.",
    tiers: [1, 2, 3, 4, 8],
  },
];

export const getAchievementProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, gladRes, hofRes, winsRes, pvpWinsRes, deathWinsRes] = await Promise.all([
      supabase.from("profiles")
        .select("denarii,reputation,training_level,scouting_level,medicus_level,armory_level,pantry_level")
        .eq("id", userId).maybeSingle(),
      supabase.from("gladiators").select("level,is_beast").eq("owner_id", userId),
      supabase.from("hall_of_fame").select("level").eq("owner_id", userId),
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("result", "win"),
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("result", "win").in("difficulty", ["pvp", "pvp_death"]),
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("result", "win").eq("difficulty", "pvp_death"),
    ]);
    const profile = profileRes.data;
    const glads = gladRes.data ?? [];
    const hof = hofRes.data ?? [];
    const facilities = profile
      ? profile.training_level + profile.scouting_level + profile.medicus_level + profile.armory_level + profile.pantry_level
      : 0;

    const progress: Record<string, number> = {
      level: Math.max(0, ...glads.map(g => g.level), ...hof.map(h => h.level)),
      wins: winsRes.count ?? 0,
      pvpWins: pvpWinsRes.count ?? 0,
      deathWins: deathWinsRes.count ?? 0,
      facilities,
      reputation: profile?.reputation ?? 0,
      denarii: profile?.denarii ?? 0,
      recruits: glads.length + hof.length,
      beasts: glads.filter(g => g.is_beast).length,
    };
    return { progress };
  });

// ============================================================
// CURSUS HONORUM — passive income. Every 30 minutes, send a delegation of
// gladiators to court Rome's high society for a shot at coin, renown, or a
// gift — or, sometimes, a bruised ego. Purely social: no fight, no HP risk
// beyond the rare "injury" event. See src/lib/social-events.ts for the
// 100-event pool this rolls from.
// ============================================================
export const SOCIAL_COOLDOWN_MINUTES = 30;

// Delegation size scales 1:1 with facility level.
export function socialDelegationSize(socialLevel: number): number {
  return Math.max(1, Math.min(MAX_FACILITY, socialLevel));
}

// Odds shift toward positive outcomes as the facility levels up — 55/35/10
// at level 1 (matching the base pool composition), 75/15/10 at level 5.
// Neutral holds steady; the shift moves weight from negative to positive.
export function socialToneWeights(socialLevel: number): Record<SocialTone, number> {
  const shift = Math.max(0, socialLevel - 1) * 0.05;
  const negative = Math.max(0.15, 0.35 - shift);
  const positive = Math.min(0.75, 0.55 + shift);
  const neutral = Math.max(0, 1 - negative - positive);
  return { positive, negative, neutral };
}

function pickSocialEvent(socialLevel: number): SocialEvent {
  const weights = socialToneWeights(socialLevel);
  const r = Math.random();
  const tone: SocialTone =
    r < weights.positive ? "positive" :
    r < weights.positive + weights.negative ? "negative" :
    "neutral";
  const pool = SOCIAL_EVENTS.filter(e => e.tone === tone);
  return pick(pool);
}

// Rescales the SOCIAL_EVENTS pool's hand-authored denarii/reputation amounts
// (applied to both positive and negative outcomes, before jitter/party-size
// scaling) without having to touch all ~100 entries individually.
const SOCIAL_DENARII_SCALE = 0.8;
const SOCIAL_REPUTATION_SCALE = 0.5;

// "Marcus" / "Marcus and Quintus" / "Marcus, Quintus, and Titus"
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export const runSocialEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorIds: z.array(z.string().uuid()).min(1).max(MAX_FACILITY),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");

    const maxSize = socialDelegationSize(profile.social_level);
    if (data.gladiatorIds.length > maxSize) throw new Error(`Cursus Honorum can only send ${maxSize} at this level`);

    const { data: last } = await supabase
      .from("social_events")
      .select("created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) {
      const nextAt = new Date(last.created_at).getTime() + SOCIAL_COOLDOWN_MINUTES * 60_000;
      if (Date.now() < nextAt) {
        const mins = Math.max(1, Math.ceil((nextAt - Date.now()) / 60_000));
        throw new Error(`Your delegation is still resting — ${mins}m until the next outing`);
      }
    }

    const { data: glads } = await supabase
      .from("gladiators")
      .select("*")
      .in("id", data.gladiatorIds)
      .eq("owner_id", userId);
    const party = glads ?? [];
    if (party.length !== data.gladiatorIds.length) throw new Error("One of those gladiators isn't yours");
    if (party.some(g => g.status === "dead")) throw new Error("The dead do not attend feasts");

    const event = pickSocialEvent(profile.social_level);
    const names = party.map(g => g.name);
    const text = event.text.replace("{g}", joinNames(names));

    let denariiDelta = 0;
    let reputationDelta = 0;
    let summary = "";
    const gladiatorUpdates: { id: string; patch: Record<string, unknown> }[] = [];

    if (event.outcome === "denarii") {
      const jitter = 0.85 + Math.random() * 0.3;
      const base = Math.max(1, Math.round((event.amount ?? 0) * SOCIAL_DENARII_SCALE * jitter));
      denariiDelta = event.tone === "positive" ? applyGoldBonus(base * party.length, profile.relics, profile.boss_kills as Record<string, number>) : -base;
      summary = `${denariiDelta > 0 ? "+" : ""}${denariiDelta} denarii`;
    } else if (event.outcome === "reputation") {
      const base = Math.max(1, Math.round((event.amount ?? 0) * SOCIAL_REPUTATION_SCALE));
      reputationDelta = event.tone === "positive" ? base * party.length : -base;
      summary = `${reputationDelta > 0 ? "+" : ""}${reputationDelta} fame`;
    } else if (event.outcome === "xp") {
      const base = event.amount ?? 0;
      for (const g of party) {
        const newXp = g.experience + base;
        const xpForNext = g.level * 100;
        const leveledUp = newXp >= xpForNext;
        gladiatorUpdates.push({
          id: g.id,
          patch: leveledUp
            ? { experience: newXp - xpForNext, level: g.level + 1 }
            : { experience: newXp },
        });
      }
      summary = `+${base} XP each`;
    } else if (event.outcome === "gear") {
      const slotKeys = ["weapon_tier", "armor_tier", "helmet_tier", "legs_tier", "offhand_tier"] as const;
      const slotLabels: Record<string, string> = {
        weapon_tier: "weapon", armor_tier: "cuirass", helmet_tier: "helmet", legs_tier: "greaves", offhand_tier: "off-hand",
      };
      const perGladiator: string[] = [];
      for (const g of party) {
        const row = g as unknown as Record<string, number>;
        const options = slotKeys.filter(k => (row[k] ?? 0) < MAX_GEAR_TIER);
        if (options.length === 0) {
          // Already mastercrafted everywhere — a small consolation purse instead.
          const consolation = applyGoldBonus(Math.max(1, Math.round(100 * SOCIAL_DENARII_SCALE * (0.85 + Math.random() * 0.3))), profile.relics, profile.boss_kills as Record<string, number>);
          denariiDelta += consolation;
          perGladiator.push(`${g.name}: already mastercrafted — +${consolation} denarii instead`);
          continue;
        }
        const slot = options[Math.floor(Math.random() * options.length)];
        gladiatorUpdates.push({ id: g.id, patch: { [slot]: row[slot] + 1 } });
        perGladiator.push(`${g.name}: +1 ${slotLabels[slot]}`);
      }
      summary = perGladiator.join(", ");
    } else if (event.outcome === "injury") {
      const victim = party[Math.floor(Math.random() * party.length)];
      const hours = injuryHours(event.amount ?? 6, victim.agility, profile.medicus_level, profile.training_level);
      gladiatorUpdates.push({ id: victim.id, patch: { injury_until: new Date(Date.now() + hours * 3600_000).toISOString() } });
      summary = `${victim.name} injured — ${hours}h to recover`;
    }

    for (const u of gladiatorUpdates) {
      const { error: updateErr } = await supabaseAdmin.from("gladiators").update(u.patch as never).eq("id", u.id);
      if (updateErr) throw new Error(updateErr.message);
    }
    if (denariiDelta !== 0 || reputationDelta !== 0) {
      await supabaseAdmin.from("profiles").update({
        denarii: Math.max(0, profile.denarii + denariiDelta),
        reputation: Math.max(0, profile.reputation + reputationDelta),
      }).eq("id", userId);
    }

    const fullLog = summary ? `${text} (${summary})` : text;
    const { error: insertErr } = await supabaseAdmin.from("social_events").insert({
      owner_id: userId,
      event_id: event.id,
      tone: event.tone,
      gladiator_names: names,
      log: fullLog,
      denarii_delta: denariiDelta,
      reputation_delta: reputationDelta,
    });
    if (insertErr) throw new Error(insertErr.message);

    return { ok: true, tone: event.tone, log: fullLog, denariiDelta, reputationDelta };
  });

