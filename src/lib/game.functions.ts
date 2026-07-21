import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import backwaterImg from "@/assets/arena/backwater-pits.jpg.asset.json";
import localImg from "@/assets/arena/local-games.jpg.asset.json";
import provincialImg from "@/assets/arena/provincial-munera.jpg.asset.json";
import capuaImg from "@/assets/arena/grand-capua.jpg.asset.json";
import colosseumImg from "@/assets/arena/colosseum.jpg.asset.json";
import emperorImg from "@/assets/arena/emperor-spectacle.jpg.asset.json";

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

// Armory level required to CRAFT gear of a given tier.
// Basic gear needs a village smith; masterwork needs the Master Forge.
const ARMORY_REQ_FOR_TIER = [0, 1, 1, 2, 2, 3, 3, 4, 5];
export function requiredArmoryLevel(tier: number): number {
  const t = Math.max(1, Math.min(MAX_GEAR_TIER, tier));
  return ARMORY_REQ_FOR_TIER[t] ?? 5;
}

// Stat cap grows with training facility (+10 per training-yard level)
export const statCap = (trainingLevel: number) => 15 + trainingLevel * 10; // lvl1=25, lvl5=65
// Max health scales with stamina: +5 HP per point
export const maxHealth = (stamina: number) => 100 + stamina * 5;
// Training cost falls with training facility level
export const trainCost = (trainingLevel: number) => Math.max(20, 50 - (trainingLevel - 1) * 6);
// Gear upgrade cost by slot, tier, and armory level
const SLOT_COST_MULT: Record<string, number> = {
  weapon: 1.0, armor: 0.85, helmet: 0.55, legs: 0.55, offhand: 0.7,
};
export const gearCost = (slot: "weapon" | "armor" | "helmet" | "legs" | "offhand", currentTier: number, armoryLevel: number) => {
  const base = 150 * (currentTier + 1) * (SLOT_COST_MULT[slot] ?? 1);
  return Math.max(40, Math.floor(base * (1 - (armoryLevel - 1) * 0.1)));
};

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function generateGladiator(scoutingLevel: number) {
  // Better scouting = better base stats + chance of beast
  const beastChance = Math.min(0.02 + scoutingLevel * 0.03, 0.2);
  if (Math.random() < beastChance) {
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
  const healthMod = g.health / maxHealth(g.stamina);
  const raw = (base + gear + lvl) * healthMod * levelMult;
  const skillMod = 1 + skillLevel * 0.08; // +8% per skill level for the matching style
  return Math.floor(raw * skillMod);
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
    const [profile, gladiators, matches, skills, hall] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("gladiators").select("*").eq("owner_id", userId).order("created_at", { ascending: true }),
      supabase.from("matches").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("ludus_skills").select("*").eq("owner_id", userId),
      supabase.from("hall_of_fame").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    return {
      profile: profile.data,
      gladiators: gladiators.data ?? [],
      matches: matches.data ?? [],
      skills: skills.data ?? [],
      hallOfFame: hall.data ?? [],
    };
  });


// ---------- FACILITY UPGRADE ----------
export const upgradeFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    facility: z.enum(["training", "scouting", "medicus", "armory", "pantry"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const col = `${data.facility}_level` as "training_level" | "scouting_level" | "medicus_level" | "armory_level" | "pantry_level";
    const curr = (profile as unknown as Record<string, number>)[col];
    if (curr >= MAX_FACILITY) throw new Error("Facility already at max level");
    const cost = FACILITY_COST(curr);
    if (profile.denarii < cost) throw new Error(`Need ${cost} denarii`);
    const next = curr + 1;
    const patch =
      data.facility === "training" ? { denarii: profile.denarii - cost, training_level: next } :
      data.facility === "scouting" ? { denarii: profile.denarii - cost, scouting_level: next } :
      data.facility === "medicus" ? { denarii: profile.denarii - cost, medicus_level: next } :
      data.facility === "pantry" ? { denarii: profile.denarii - cost, pantry_level: next } :
      { denarii: profile.denarii - cost, armory_level: next };
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
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
    if (profile.denarii < cost) throw new Error(`Need ${cost} denarii`);

    if (existing) {
      const { error } = await supabase.from("ludus_skills").update({ level: curr + 1 }).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("ludus_skills").insert({
        owner_id: userId, weapon_type: data.weaponType, level: 1,
      });
      if (error) throw new Error(error.message);
    }
    await supabase.from("profiles").update({ denarii: profile.denarii - cost }).eq("id", userId);
    return { ok: true, cost, newLevel: curr + 1 };
  });

// ---------- RECRUIT ----------
export const recruitGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const COST = Math.max(60, 100 - (profile.scouting_level - 1) * 10);
    if (profile.denarii < COST) throw new Error(`Scouting fee: ${COST} denarii`);

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

    const { error: insertErr } = await supabase.from("gladiators").insert({ owner_id: userId, ...g, total_invested: COST });
    if (insertErr) throw new Error(insertErr.message);
    const { error: updErr } = await supabase.from("profiles").update({ denarii: profile.denarii - COST }).eq("id", userId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true, isBeast: g.is_beast, name: g.name };
  });


// ---------- TRAIN ----------
export const trainGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    stat: z.enum(["strength", "agility", "stamina", "technique"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const COST = Math.max(20, 50 - (profile.training_level - 1) * 6);
    if (profile.denarii < COST) throw new Error(`Training costs ${COST} denarii`);

    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("Gladiator has fallen");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");

    const cap = statCap(profile.training_level);
    if ((g[data.stat] as number) >= cap) throw new Error(`Stat capped at ${cap} — upgrade Training Yard`);

    // Better training = bigger gains
    const bigChance = 0.2 + profile.training_level * 0.1;
    const gain = Math.random() < bigChance ? 2 : 1;
    const newVal = Math.min(cap, (g[data.stat] as number) + gain);
    const basePatch: Record<string, number | string | null> = { total_invested: (g.total_invested ?? 0) + COST };
    const patch =
      data.stat === "strength" ? { ...basePatch, strength: newVal } :
      data.stat === "agility" ? { ...basePatch, agility: newVal } :
      data.stat === "stamina" ? { ...basePatch, stamina: newVal, health: Math.min(maxHealth(newVal), g.health + (newVal - g.stamina) * 5) } :
      { ...basePatch, technique: newVal };
    const { error } = await supabase.from("gladiators").update(patch).eq("id", g.id);
    if (error) throw new Error(error.message);
    await supabase.from("profiles").update({ denarii: profile.denarii - COST }).eq("id", userId);
    return { ok: true, gain, stat: data.stat };
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
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
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
    if (profile.denarii < cost) throw new Error(`Need ${cost} denarii`);

    const patch = { [tierField]: currentTier + 1, total_invested: (g.total_invested ?? 0) + cost };
    const { error } = await supabase.from("gladiators").update(patch as never).eq("id", g.id);

    if (error) throw new Error(error.message);
    await supabase.from("profiles").update({ denarii: profile.denarii - cost }).eq("id", userId);
    return { ok: true, cost };
  });


// ---------- HEAL ----------
export const healGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gladiatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("The physician cannot revive the dead");

    const hpMax = maxHealth(g.stamina);
    const missing = hpMax - g.health;
    if (missing <= 0 && !g.injury_until) throw new Error("Already at full health");
    const baseCost = Math.max(30, missing * 2);
    const cost = Math.max(15, Math.floor(baseCost * (1 - (profile.medicus_level - 1) * 0.12)));
    if (profile.denarii < cost) throw new Error(`Physician needs ${cost} denarii`);
    const { error } = await supabase.from("gladiators").update({
      health: hpMax,
      injury_until: null,
      total_invested: (g.total_invested ?? 0) + cost,
    }).eq("id", g.id);
    if (error) throw new Error(error.message);
    await supabase.from("profiles").update({ denarii: profile.denarii - cost }).eq("id", userId);
    return { ok: true, cost };
  });


// ---------- DISMISS ----------
export const dismissGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gladiatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("gladiators").delete().eq("id", data.gladiatorId).eq("owner_id", userId);
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
  reward: number;        // base denarii
  xp: number;            // base XP
  rep: number;           // fame on win
  opponents: string[];   // flavor opponent pool
};

export const ARENA_TIERS: ArenaTier[] = [
  {
    key: "backwater", label: "Backwater Pits",
    flavor: "Muddy village pits — a purse of copper and jeering peasants.",
    imageUrl: backwaterImg.url,
    reqFame: 0, reqLevel: 1, reqWins: 0,
    powerMin: 50, powerMax: 150, reward: 70, xp: 35, rep: 1,
    opponents: ["Drunken Brawler", "Runaway Slave", "Village Bully", "Starving Thief"],
  },
  {
    key: "local", label: "Local Games",
    flavor: "Small town munera — a wooden stand and a modest crowd.",
    imageUrl: localImg.url,
    reqFame: 5, reqLevel: 2, reqWins: 1,
    powerMin: 300, powerMax: 700, reward: 160, xp: 75, rep: 3,
    opponents: ["Provincial Auctoratus", "Retired Legionary", "Pit Veteran", "Ostian Bruiser"],
  },
  {
    key: "provincial", label: "Provincial Munera",
    flavor: "A magistrate's games — proper editors, painted programs, real steel.",
    imageUrl: provincialImg.url,
    reqFame: 25, reqLevel: 3, reqWins: 3,
    powerMin: 900, powerMax: 1300, reward: 320, xp: 130, rep: 6,
    opponents: ["Praetorian Washout", "Iberian Veteran", "Champion of Ostia", "Nubian Slayer"],
  },
  {
    key: "capua", label: "Grand Games of Capua",
    flavor: "Capua's arena, where fortunes are made and legions bet their pay.",
    imageUrl: capuaImg.url,
    reqFame: 75, reqLevel: 5, reqWins: 8,
    powerMin: 1300, powerMax: 1700, reward: 650, xp: 240, rep: 14,
    opponents: ["Champion of Capua", "The Bloody Bull", "Marcus Ferrus", "The Thracian Wolf"],
  },
  {
    key: "colosseum", label: "Colosseum of Rome",
    flavor: "The Flavian Amphitheatre. Fifty thousand voices thirsting for blood.",
    imageUrl: colosseumImg.url,
    reqFame: 200, reqLevel: 8, reqWins: 20,
    powerMin: 1700, powerMax: 2200, reward: 1300, xp: 420, rep: 30,
    opponents: ["Priscus the Undefeated", "Verus of the Palatine", "Flamma Redivivus", "The Iron Senator"],
  },
  {
    key: "emperor", label: "Emperor's Spectacle",
    flavor: "The Emperor himself watches. Death here becomes legend.",
    imageUrl: emperorImg.url,
    reqFame: 500, reqLevel: 12, reqWins: 40,
    powerMin: 2400, powerMax: 3200, reward: 2800, xp: 800, rep: 70,
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

// ---------- FIGHT ----------
export const fightMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    difficulty: z.enum(TIER_KEYS as unknown as [string, ...string[]]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    if (g.health < 30) throw new Error("Gladiator too wounded to fight");

    const tier = ARENA_TIERS.find(t => t.key === data.difficulty);
    if (!tier) throw new Error("Unknown arena");
    const lock = tierUnlockReason(tier, profile.reputation, g.level, g.wins);
    if (lock) throw new Error(lock);

    const { data: skillRow } = await supabase
      .from("ludus_skills").select("level")
      .eq("owner_id", userId).eq("weapon_type", g.weapon_type).maybeSingle();
    const skillLevel = skillRow?.level ?? 0;
    const { data: defenseRow } = await supabase
      .from("ludus_skills").select("level")
      .eq("owner_id", userId).eq("weapon_type", "defense").maybeSingle();
    const defenseLevel = defenseRow?.level ?? 0;

    const myPower = gladiatorPower(g, skillLevel);
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
    log.push(`Your blade strikes for ${myDmg.min}–${myDmg.max}; your armor absorbs ${myMit.min}–${myMit.max}.`);

    let myHp = 100, oppHp = 100;
    const rounds = rand(3, 5);
    for (let i = 1; i <= rounds && myHp > 0 && oppHp > 0; i++) {
      const myRoll = myPower + rand(0, 40);
      const oppRoll = opponentPower + rand(0, 40);
      if (myRoll > oppRoll) {
        const dmg = rollDamage(g.weapon_tier, opponent, 0, g.level);
        oppHp -= dmg;
        log.push(`Round ${i}: ${g.name} lands a blow for ${dmg}.`);
      } else {
        const dmg = rollDamage(oppGearTier, g, defenseLevel, tier.reqLevel);
        myHp -= dmg;
        log.push(`Round ${i}: ${opponentName} strikes ${g.name} for ${dmg}.`);
      }
    }


    const won = oppHp <= myHp;
    const denariiGained = won ? tier.reward + rand(0, Math.floor(tier.reward * 0.2)) : Math.floor(tier.reward * 0.12);
    const xpGained = won ? tier.xp : Math.floor(tier.xp * 0.4);
    const repGained = won ? tier.rep : 0;

    const damageTaken = Math.max(5, 100 - Math.max(0, myHp));
    const newHealth = Math.max(0, g.health - damageTaken);
    let injuryUntil: string | null = null;
    // Medicus reduces injury duration
    if (newHealth <= 0) {
      log.push(`${g.name} falls, gravely wounded. Weeks in the valetudinarium await.`);
    } else if (damageTaken > 60) {
      const baseDays = rand(2, 4);
      const days = Math.max(1, baseDays - Math.floor((profile.medicus_level - 1) / 2));
      injuryUntil = new Date(Date.now() + days * 86400_000).toISOString();
      log.push(`${g.name} is injured — cannot fight for ${days}d.`);
    }

    log.push(won
      ? `Victory! The crowd showers ${g.name} with praise. +${denariiGained} denarii, +${xpGained} XP.`
      : `Defeat. ${g.name} limps from the sand. +${denariiGained} denarii.`);

    const newXp = g.experience + xpGained;
    const xpForNext = g.level * 100;
    let newLevel = g.level;
    let finalXp = newXp;
    if (newXp >= xpForNext) {
      newLevel = g.level + 1;
      finalXp = newXp - xpForNext;
      log.push(`⚔ ${g.name} advances to level ${newLevel}!`);
    }

    const gladPatch = {
      health: newHealth,
      injury_until: injuryUntil,
      experience: finalXp,
      level: newLevel,
      wins: g.wins + (won ? 1 : 0),
      losses: g.losses + (won ? 0 : 1),
    };

    const { error: gErr } = await supabase.from("gladiators").update(gladPatch).eq("id", g.id);
    if (gErr) throw new Error(gErr.message);

    await supabase.from("profiles").update({
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
      log,
    });

    return { won, log, denariiGained, xpGained, repGained };
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
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status === "dead") throw new Error("Gladiator has fallen");
    if (g.status === "challenging") throw new Error("Already posted for a challenge");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    if (g.health < 30) throw new Error("Gladiator too wounded");

    const rating = matchRating(g);
    const { data: inserted, error } = await supabase.from("pvp_challenges").insert({
      challenger_id: userId,
      challenger_gladiator_id: g.id,
      rating,
      to_death: !!data.toDeath,
      status: "open",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await supabase.from("gladiators").update({ status: "challenging" }).eq("id", g.id);
    return { ok: true, id: inserted.id };
  });

// ---------- CANCEL CHALLENGE ----------
export const cancelPvpChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ challengeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c } = await supabase.from("pvp_challenges").select("*").eq("id", data.challengeId).eq("challenger_id", userId).maybeSingle();
    if (!c) throw new Error("Challenge not found");
    if (c.status !== "open") throw new Error("Challenge already resolved");
    await supabase.from("pvp_challenges").delete().eq("id", c.id);
    await supabase.from("gladiators").update({ status: "idle" }).eq("id", c.challenger_gladiator_id).eq("owner_id", userId);
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
        ? supabase.from("profiles").select("id,ludus_name,reputation").in("id", ownerIds)
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
    if (g.health < 30) throw new Error("Gladiator too wounded");

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

    const toDeath = !!c.to_death;
    const rewardMult = toDeath ? 5 : 1;

    const { data: mySkill } = await supabase.from("ludus_skills").select("level").eq("owner_id", userId).eq("weapon_type", g.weapon_type).maybeSingle();
    const { data: oppSkill } = await supabaseAdmin.from("ludus_skills").select("level").eq("owner_id", opp.owner_id).eq("weapon_type", opp.weapon_type).maybeSingle();
    const { data: myDefense } = await supabase.from("ludus_skills").select("level").eq("owner_id", userId).eq("weapon_type", "defense").maybeSingle();
    const { data: oppDefense } = await supabaseAdmin.from("ludus_skills").select("level").eq("owner_id", opp.owner_id).eq("weapon_type", "defense").maybeSingle();
    const myPower = gladiatorPower(g, mySkill?.level ?? 0);
    const oppPower = gladiatorPower(opp, oppSkill?.level ?? 0);
    const myDefenseLevel = myDefense?.level ?? 0;
    const oppDefenseLevel = oppDefense?.level ?? 0;

    const log: string[] = [];
    log.push(`${g.name} answers the call of ${opp.name}'s ludus.`);
    if (toDeath) log.push("⚔ Sine missione — a fight to the death. No quarter, no mercy.");
    log.push(`Power ${myPower} vs ${oppPower}.`);
    const myDmg = weaponDamageRange(g.weapon_tier);
    const oppDmg = weaponDamageRange(opp.weapon_tier);
    log.push(`${g.name}: ${myDmg.min}–${myDmg.max} dmg · ${opp.name}: ${oppDmg.min}–${oppDmg.max} dmg.`);
    if (myDefenseLevel > 0) log.push(`${g.name} adopts defensive stance — rank ${myDefenseLevel}.`);
    if (oppDefenseLevel > 0) log.push(`${opp.name} adopts defensive stance — rank ${oppDefenseLevel}.`);
    let myHp = 100, oHp = 100;
    for (let i = 1; i <= 5 && myHp > 0 && oHp > 0; i++) {
      const mr = myPower + rand(0, 40);
      const or = oppPower + rand(0, 40);
      if (mr > or) { const d = rollDamage(g.weapon_tier, opp, oppDefenseLevel, g.level); oHp -= d; log.push(`Round ${i}: ${g.name} strikes for ${d}.`); }
      else { const d = rollDamage(opp.weapon_tier, g, myDefenseLevel, opp.level); myHp -= d; log.push(`Round ${i}: ${opp.name} strikes for ${d}.`); }
    }

    const won = oHp <= myHp;

    const denariiGained = won ? (200 + rand(0, 80)) * rewardMult : 30;
    const xpGained = won ? 140 * rewardMult : 50;
    const repGained = won ? 8 * rewardMult : -2;

    const damageTaken = Math.max(5, 100 - Math.max(0, myHp));
    let newHealth = Math.max(0, g.health - damageTaken);
    let injuryUntil: string | null = null;
    let myDied = false;
    if (toDeath && !won) {
      myDied = true;
      newHealth = 0;
      log.push(`${g.name} falls in the sand. The crowd chants "Iugula!" — the blade is driven home.`);
    } else if (damageTaken > 60 && newHealth > 0) {
      const days = Math.max(1, rand(2, 4) - Math.floor((profile.medicus_level - 1) / 2));
      injuryUntil = new Date(Date.now() + days * 86400_000).toISOString();
      log.push(`${g.name} is injured for ${days}d.`);
    }
    log.push(won
      ? (toDeath ? `${g.name} stands victorious over ${opp.name}'s corpse. The purse is enormous.` : `Victory over ${opp.name}! Fame spreads through the provinces.`)
      : (toDeath ? `${opp.name}'s ludus claims your champion's life.` : `${opp.name}'s ludus claims the honor.`));

    await supabase.from("gladiators").update({
      health: newHealth,
      injury_until: injuryUntil,
      status: myDied ? "dead" : "idle",
      experience: g.experience + xpGained,
      level: (g.experience + xpGained) >= g.level * 100 ? g.level + 1 : g.level,
      wins: g.wins + (won ? 1 : 0),
      losses: g.losses + (won ? 0 : 1),
    }).eq("id", g.id);

    await supabase.from("profiles").update({
      denarii: profile.denarii + denariiGained,
      reputation: Math.max(0, profile.reputation + repGained),
    }).eq("id", userId);

    // Update opposing (challenger) gladiator via admin
    const oppDamage = Math.max(5, 100 - Math.max(0, oHp));
    let oppNewHealth = Math.max(0, opp.health - oppDamage);
    let oppInjury: string | null = null;
    let oppDied = false;
    if (toDeath && won) {
      oppDied = true;
      oppNewHealth = 0;
    } else if (oppDamage > 60 && oppNewHealth > 0) {
      oppInjury = new Date(Date.now() + rand(2, 4) * 86400_000).toISOString();
    }
    const oppXp = won ? 40 : 100;
    await supabaseAdmin.from("gladiators").update({
      health: oppNewHealth,
      injury_until: oppInjury,
      status: oppDied ? "dead" : "idle",
      experience: opp.experience + oppXp,
      level: (opp.experience + oppXp) >= opp.level * 100 ? opp.level + 1 : opp.level,
      wins: opp.wins + (won ? 0 : 1),
      losses: opp.losses + (won ? 1 : 0),
    }).eq("id", opp.id);

    const { data: oppProfile } = await supabaseAdmin.from("profiles").select("denarii,reputation").eq("id", opp.owner_id).maybeSingle();
    if (oppProfile) {
      await supabaseAdmin.from("profiles").update({
        denarii: oppProfile.denarii + (won ? 30 : 150 * rewardMult),
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
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.status !== "dead") throw new Error("Only fallen gladiators may be honored");

    const cost = Math.max(10, Math.ceil((g.total_invested ?? 0) * 0.05));
    if (profile.denarii < cost) throw new Error(`A proper memorial costs ${cost} denarii`);

    const { error: insErr } = await supabase.from("hall_of_fame").insert({
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

    await supabase.from("gladiators").delete().eq("id", g.id);
    await supabase.from("profiles").update({ denarii: profile.denarii - cost }).eq("id", userId);
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
  powerScale: number;
  reward: number;
  xp: number;
  rep: number;
};

export const TEAM_BATTLES: TeamBattle[] = [
  { key: "duo", label: "Paired Combat", flavor: "Two gladiators face two condemned killers.", size: 2, reqFame: 5, powerScale: 1.0, reward: 400, xp: 120, rep: 6 },
  { key: "trio_murmillo", label: "Trio of Murmillones", flavor: "Three Murmillones in disciplined formation.", size: 3, requireClass: "Murmillo", reqFame: 20, powerScale: 1.1, reward: 900, xp: 200, rep: 14 },
  { key: "beast_hunt", label: "Grand Beast Hunt (Venatio)", flavor: "Two hunters and one beast against a Nubian panther.", size: 3, requireBeast: 1, reqFame: 30, powerScale: 1.2, reward: 1100, xp: 220, rep: 16 },
  { key: "cohort", label: "Rival Ludus Melee", flavor: "Four of your best against a rival cohort.", size: 4, reqFame: 80, powerScale: 1.35, reward: 1800, xp: 320, rep: 26 },
  { key: "spectacle", label: "Emperor's Spectacle", flavor: "Five champions in a grand spectacle. Legends are made here.", size: 5, reqFame: 250, powerScale: 1.6, reward: 3600, xp: 550, rep: 55 },
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
    if (beasts !== battle.requireBeast) return `Must include exactly ${battle.requireBeast} beast`;
  }
  return null;
}

const TEAM_KEYS = TEAM_BATTLES.map(t => t.key) as [string, ...string[]];

export const fightTeamBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    battleKey: z.enum(TEAM_KEYS as unknown as [string, ...string[]]),
    gladiatorIds: z.array(z.string().uuid()).min(2).max(5),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const battle = TEAM_BATTLES.find(b => b.key === data.battleKey);
    if (!battle) throw new Error("Unknown battle");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");

    const { data: gs } = await supabase.from("gladiators").select("*").in("id", data.gladiatorIds).eq("owner_id", userId);
    const team = gs ?? [];
    const err = teamBattleRequirementError(battle, team, profile.reputation);
    if (err) throw new Error(err);

    const { data: skills } = await supabase.from("ludus_skills").select("weapon_type,level").eq("owner_id", userId);
    const skillMap = new Map((skills ?? []).map(s => [s.weapon_type, s.level]));

    const teamPower = team.reduce((sum, g) => sum + gladiatorPower(g, skillMap.get(g.weapon_type) ?? 0), 0);
    const enemyPower = Math.floor(teamPower * battle.powerScale + rand(-30, 30));

    const defenseLevel = skillMap.get("defense") ?? 0;
    const defenseReduction = 1 - defenseLevel * 0.05;

    const log: string[] = [];
    log.push(`${battle.label} begins. ${team.map(t => t.name).join(", ")} enter the sand.`);
    log.push(`Team power ${teamPower} vs ${enemyPower}.`);
    if (defenseLevel > 0) log.push(`Defensive doctrine: rank ${defenseLevel} — the cohort shrugs off heavier blows.`);

    let teamHp = team.length * 100;
    let enemyHp = team.length * 100;
    for (let i = 1; i <= 6 && teamHp > 0 && enemyHp > 0; i++) {
      const mr = teamPower + rand(0, 60);
      const or = enemyPower + rand(0, 60);
      if (mr > or) { const d = rand(25, 45); enemyHp -= d; log.push(`Round ${i}: your cohort presses for ${d}.`); }
      else { const d = Math.max(5, Math.floor(rand(25, 45) * defenseReduction)); teamHp -= d; log.push(`Round ${i}: the enemy strikes for ${d}.`); }
    }
    const won = enemyHp <= teamHp;

    const denariiGained = won ? battle.reward + rand(0, Math.floor(battle.reward * 0.2)) : Math.floor(battle.reward * 0.15);
    const xpEach = Math.floor((won ? battle.xp : Math.floor(battle.xp * 0.4)) / 1);
    const repGained = won ? battle.rep : 0;

    log.push(won
      ? `Victory! The cohort is showered with denarii and honor. +${denariiGained}d, +${repGained} fame.`
      : `The cohort is broken. Small purse of ${denariiGained}d for their courage.`);

    // Distribute damage across team members
    for (const g of team) {
      const shareDamage = Math.floor((team.length * 100 - Math.max(0, teamHp)) / team.length) + rand(-5, 10);
      const dmg = Math.max(5, shareDamage);
      const newHealth = Math.max(0, g.health - dmg);
      let injuryUntil: string | null = null;
      if (dmg > 55 && newHealth > 0) {
        const days = Math.max(1, rand(2, 4) - Math.floor((profile.medicus_level - 1) / 2));
        injuryUntil = new Date(Date.now() + days * 86400_000).toISOString();
      }
      const newXp = g.experience + xpEach;
      const xpNext = g.level * 100;
      const leveledUp = newXp >= xpNext;
      await supabase.from("gladiators").update({
        health: newHealth,
        injury_until: injuryUntil,
        experience: leveledUp ? newXp - xpNext : newXp,
        level: leveledUp ? g.level + 1 : g.level,
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

    await supabase.from("profiles").update({
      denarii: profile.denarii + denariiGained,
      reputation: profile.reputation + repGained,
    }).eq("id", userId);

    return { won, log, denariiGained, repGained };
  });


// ============================================================
// GLOBAL LEADERBOARDS — fame across all ludi and gladiators
// ============================================================
export const getLeaderboards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [ludi, glads] = await Promise.all([
      supabase.from("profiles")
        .select("id,ludus_name,reputation,training_level,scouting_level,medicus_level,armory_level,best_rank")
        .order("reputation", { ascending: false })
        .limit(25),
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
          return supabase.from("profiles").update({ best_rank: rank } as never).eq("id", p.id);
        }
        return Promise.resolve();
      }),
      ...gladRows.map((g, i) => {
        const rank = i + 1;
        if (g.best_rank == null || rank < g.best_rank) {
          return supabase.from("gladiators").update({ best_rank: rank } as never).eq("id", g.id);
        }
        return Promise.resolve();
      }),
    ]);

    const ownerIds = [...new Set(gladRows.map(g => g.owner_id))];
    const { data: owners } = ownerIds.length
      ? await supabase.from("profiles").select("id,ludus_name").in("id", ownerIds)
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
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles")
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
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.ludus_name !== undefined) patch.ludus_name = data.ludus_name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.showcase_limit !== undefined) patch.showcase_limit = data.showcase_limit;
    if (data.showcase_gladiator_ids !== undefined) patch.showcase_gladiator_ids = data.showcase_gladiator_ids;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("profiles")
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
    const { data: profile, error } = await supabase.from("profiles")
      .select("id,ludus_name,description,bio,showcase_limit,showcase_gladiator_ids,reputation,best_rank,training_level,scouting_level,medicus_level,armory_level,pantry_level,created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
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

