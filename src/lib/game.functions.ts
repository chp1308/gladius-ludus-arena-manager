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
type WeaponType = typeof WEAPON_TYPES[number] | "beast_lion" | "beast_tiger";

export const WEAPON_LABELS: Record<string, string> = {
  gladius: "Gladius & Shield",
  spear: "Spear",
  net: "Net & Trident",
  dual: "Dual Blades",
  beast_lion: "Lion",
  beast_tiger: "Tiger",
};

// Facility caps and effects
const MAX_FACILITY = 5;
const MAX_SKILL = 5;
const FACILITY_COST = (curr: number) => 500 * (curr + 1); // 1->2 costs 1000
const SKILL_COST = (curr: number) => 200 * (curr + 1);

// Stat cap grows with training facility (+10 per training-yard level)
export const statCap = (trainingLevel: number) => 15 + trainingLevel * 10; // lvl1=25, lvl5=65
// Max health scales with stamina: +5 HP per point
export const maxHealth = (stamina: number) => 100 + stamina * 5;
// Training cost falls with training facility level
export const trainCost = (trainingLevel: number) => Math.max(20, 50 - (trainingLevel - 1) * 6);
// Gear upgrade cost by slot, tier, and armory level
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
    const isLion = Math.random() < 0.6;
    return {
      name: isLion ? "Roaring Lion" : "Prowling Tiger",
      origin: isLion ? "Numidia" : "India",
      class: "Beast",
      weapon_type: isLion ? "beast_lion" : "beast_tiger",
      is_beast: true,
      strength: isLion ? rand(9, 14) : rand(8, 12),
      agility: isLion ? rand(6, 10) : rand(9, 14),
      stamina: rand(7, 11),
      technique: rand(1, 3),
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

function gladiatorPower(
  g: {
    strength: number; agility: number; stamina: number; technique: number;
    level: number; weapon_tier: number; armor_tier: number;
    helmet_tier?: number; legs_tier?: number; offhand_tier?: number;
    health: number;
    weapon_type: string;
  },
  skillLevel: number,
) {
  const base = 3 * (g.strength + g.agility + g.stamina + g.technique);
  const gear =
    g.weapon_tier * 12 + g.armor_tier * 9 +
    (g.helmet_tier ?? 1) * 4 + (g.legs_tier ?? 1) * 4 + (g.offhand_tier ?? 1) * 5;
  const lvl = g.level * 6;
  const healthMod = g.health / maxHealth(g.stamina);
  const raw = (base + gear + lvl) * healthMod;
  const skillMod = 1 + skillLevel * 0.08; // +8% per skill level for the matching style
  return Math.floor(raw * skillMod);
}

// ---------- READ ----------
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
    facility: z.enum(["training", "scouting", "medicus", "armory"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const col = `${data.facility}_level` as "training_level" | "scouting_level" | "medicus_level" | "armory_level";
    const curr = profile[col] as number;
    if (curr >= MAX_FACILITY) throw new Error("Facility already at max level");
    const cost = FACILITY_COST(curr);
    if (profile.denarii < cost) throw new Error(`Need ${cost} denarii`);
    const next = curr + 1;
    const patch =
      data.facility === "training" ? { denarii: profile.denarii - cost, training_level: next } :
      data.facility === "scouting" ? { denarii: profile.denarii - cost, scouting_level: next } :
      data.facility === "medicus" ? { denarii: profile.denarii - cost, medicus_level: next } :
      { denarii: profile.denarii - cost, armory_level: next };
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, cost, newLevel: next };
  });

// ---------- SKILL UPGRADE ----------
export const upgradeSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    weaponType: z.enum(["gladius", "spear", "net", "dual", "beast_lion", "beast_tiger"]),
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
const SLOT_COST_MULT: Record<string, number> = {
  weapon: 1.0,
  armor: 0.85,
  helmet: 0.55,
  legs: 0.55,
  offhand: 0.7,
};
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
    if (g.is_beast) throw new Error("Beasts do not wear gear");

    const tierField = `${data.slot === "weapon" ? "weapon" : data.slot === "armor" ? "armor" : data.slot}_tier` as
      "weapon_tier" | "armor_tier" | "helmet_tier" | "legs_tier" | "offhand_tier";
    const currentTier = (g as unknown as Record<string, number>)[tierField] ?? 1;
    if (currentTier >= 5) throw new Error("Already at max tier");
    const baseCost = 150 * (currentTier + 1) * SLOT_COST_MULT[data.slot];
    const cost = Math.max(40, Math.floor(baseCost * (1 - (profile.armory_level - 1) * 0.1)));
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
  powerScale: number;    // opponent power multiplier
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
    powerScale: 0.80, reward: 70, xp: 35, rep: 1,
    opponents: ["Drunken Brawler", "Runaway Slave", "Village Bully", "Starving Thief"],
  },
  {
    key: "local", label: "Local Games",
    flavor: "Small town munera — a wooden stand and a modest crowd.",
    imageUrl: localImg.url,
    reqFame: 5, reqLevel: 2, reqWins: 1,
    powerScale: 1.0, reward: 160, xp: 75, rep: 3,
    opponents: ["Provincial Auctoratus", "Retired Legionary", "Pit Veteran", "Ostian Bruiser"],
  },
  {
    key: "provincial", label: "Provincial Munera",
    flavor: "A magistrate's games — proper editors, painted programs, real steel.",
    imageUrl: provincialImg.url,
    reqFame: 25, reqLevel: 3, reqWins: 3,
    powerScale: 1.15, reward: 320, xp: 130, rep: 6,
    opponents: ["Praetorian Washout", "Iberian Veteran", "Champion of Ostia", "Nubian Slayer"],
  },
  {
    key: "capua", label: "Grand Games of Capua",
    flavor: "Capua's arena, where fortunes are made and legions bet their pay.",
    imageUrl: capuaImg.url,
    reqFame: 75, reqLevel: 5, reqWins: 8,
    powerScale: 1.35, reward: 650, xp: 240, rep: 14,
    opponents: ["Champion of Capua", "The Bloody Bull", "Marcus Ferrus", "The Thracian Wolf"],
  },
  {
    key: "colosseum", label: "Colosseum of Rome",
    flavor: "The Flavian Amphitheatre. Fifty thousand voices thirsting for blood.",
    imageUrl: colosseumImg.url,
    reqFame: 200, reqLevel: 8, reqWins: 20,
    powerScale: 1.55, reward: 1300, xp: 420, rep: 30,
    opponents: ["Priscus the Undefeated", "Verus of the Palatine", "Flamma Redivivus", "The Iron Senator"],
  },
  {
    key: "emperor", label: "Emperor's Spectacle",
    flavor: "The Emperor himself watches. Death here becomes legend.",
    imageUrl: emperorImg.url,
    reqFame: 500, reqLevel: 12, reqWins: 40,
    powerScale: 1.8, reward: 2800, xp: 800, rep: 70,
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

    const myPower = gladiatorPower(g, skillLevel);
    const opponentPower = Math.floor(myPower * tier.powerScale + rand(-15, 15));
    const opponentName = g.is_beast
      ? pick(["Doomed Slave", "Damnatus", "Condemned Thief"])
      : pick(tier.opponents);

    const log: string[] = [];
    log.push(`${g.name} enters ${tier.label} to face ${opponentName}.`);
    if (skillLevel > 0) log.push(`Style mastery: ${WEAPON_LABELS[g.weapon_type] ?? g.weapon_type} — rank ${skillLevel}.`);
    log.push(`The crowd roars. Power ${myPower} vs ${opponentPower}.`);

    let myHp = 100, oppHp = 100;
    const rounds = rand(3, 5);
    for (let i = 1; i <= rounds && myHp > 0 && oppHp > 0; i++) {
      const myRoll = myPower + rand(0, 40);
      const oppRoll = opponentPower + rand(0, 40);
      if (myRoll > oppRoll) {
        const dmg = rand(15, 30);
        oppHp -= dmg;
        log.push(`Round ${i}: ${g.name} lands a blow for ${dmg}.`);
      } else {
        const dmg = rand(15, 30);
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

// ============================================================
// PVP — challenge other players' active gladiators
// ============================================================

export const listRivalGladiators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ myGladiatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mine } = await supabase
      .from("gladiators").select("level").eq("id", data.myGladiatorId).eq("owner_id", userId).maybeSingle();
    if (!mine) throw new Error("Not your gladiator");

    const { data: rivals, error } = await supabase
      .from("gladiators")
      .select("id,owner_id,name,class,weapon_type,is_beast,level,wins,losses,strength,agility,stamina,technique,health,injury_until,weapon_tier,armor_tier")
      .neq("owner_id", userId)
      .gte("health", 30)
      .order("level", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const active = (rivals ?? []).filter(r => !r.injury_until || new Date(r.injury_until) < new Date());
    const ownerIds = [...new Set(active.map(r => r.owner_id))];
    let owners: { id: string; ludus_name: string; reputation: number }[] = [];
    if (ownerIds.length) {
      const { data: os } = await supabase.from("profiles").select("id,ludus_name,reputation").in("id", ownerIds);
      owners = os ?? [];
    }
    const oMap = new Map(owners.map(o => [o.id, o]));
    return active.map(r => ({
      ...r,
      ludus_name: oMap.get(r.owner_id)?.ludus_name ?? "Unknown Ludus",
      ludus_fame: oMap.get(r.owner_id)?.reputation ?? 0,
    }));
  });

export const fightPvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    myGladiatorId: z.string().uuid(),
    opponentGladiatorId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.myGladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    if (g.health < 30) throw new Error("Gladiator too wounded");

    const { data: opp } = await supabase.from("gladiators").select("*").eq("id", data.opponentGladiatorId).maybeSingle();
    if (!opp) throw new Error("Opponent not found");
    if (opp.owner_id === userId) throw new Error("Cannot fight your own gladiator");
    if (opp.health < 30) throw new Error("Opponent is not fit to fight");
    if (opp.injury_until && new Date(opp.injury_until) > new Date()) throw new Error("Opponent is injured");

    const { data: mySkill } = await supabase.from("ludus_skills").select("level").eq("owner_id", userId).eq("weapon_type", g.weapon_type).maybeSingle();
    const { data: oppSkill } = await supabase.from("ludus_skills").select("level").eq("owner_id", opp.owner_id).eq("weapon_type", opp.weapon_type).maybeSingle();
    const myPower = gladiatorPower(g, mySkill?.level ?? 0);
    const oppPower = gladiatorPower(opp, oppSkill?.level ?? 0);

    const log: string[] = [];
    log.push(`${g.name} challenges ${opp.name} of a rival ludus.`);
    log.push(`Power ${myPower} vs ${oppPower}.`);
    let myHp = 100, oHp = 100;
    for (let i = 1; i <= 5 && myHp > 0 && oHp > 0; i++) {
      const mr = myPower + rand(0, 40);
      const or = oppPower + rand(0, 40);
      if (mr > or) { const d = rand(15, 30); oHp -= d; log.push(`Round ${i}: ${g.name} strikes for ${d}.`); }
      else { const d = rand(15, 30); myHp -= d; log.push(`Round ${i}: ${opp.name} strikes for ${d}.`); }
    }
    const won = oHp <= myHp;

    // Rewards: PvP gives more fame, less coin
    const denariiGained = won ? 200 + rand(0, 80) : 30;
    const xpGained = won ? 140 : 50;
    const repGained = won ? 8 : -2;

    const damageTaken = Math.max(5, 100 - Math.max(0, myHp));
    const newHealth = Math.max(0, g.health - damageTaken);
    let injuryUntil: string | null = null;
    if (damageTaken > 60 && newHealth > 0) {
      const days = Math.max(1, rand(2, 4) - Math.floor((profile.medicus_level - 1) / 2));
      injuryUntil = new Date(Date.now() + days * 86400_000).toISOString();
      log.push(`${g.name} is injured for ${days}d.`);
    }
    log.push(won
      ? `Victory over ${opp.name}! Fame spreads through the provinces.`
      : `${opp.name}'s ludus claims the honor.`);

    await supabase.from("gladiators").update({
      health: newHealth,
      injury_until: injuryUntil,
      experience: g.experience + xpGained,
      level: (g.experience + xpGained) >= g.level * 100 ? g.level + 1 : g.level,
      wins: g.wins + (won ? 1 : 0),
      losses: g.losses + (won ? 0 : 1),
    }).eq("id", g.id);

    await supabase.from("profiles").update({
      denarii: profile.denarii + denariiGained,
      reputation: Math.max(0, profile.reputation + repGained),
    }).eq("id", userId);

    // Update opponent using admin (RLS bypass)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const oppDamage = Math.max(5, 100 - Math.max(0, oHp));
    const oppNewHealth = Math.max(0, opp.health - oppDamage);
    let oppInjury: string | null = null;
    if (oppDamage > 60 && oppNewHealth > 0) {
      oppInjury = new Date(Date.now() + rand(2, 4) * 86400_000).toISOString();
    }
    const oppXp = won ? 40 : 100;
    await supabaseAdmin.from("gladiators").update({
      health: oppNewHealth,
      injury_until: oppInjury,
      experience: opp.experience + oppXp,
      level: (opp.experience + oppXp) >= opp.level * 100 ? opp.level + 1 : opp.level,
      wins: opp.wins + (won ? 0 : 1),
      losses: opp.losses + (won ? 1 : 0),
    }).eq("id", opp.id);

    // Opponent owner rewards
    const { data: oppProfile } = await supabaseAdmin.from("profiles").select("denarii,reputation").eq("id", opp.owner_id).maybeSingle();
    if (oppProfile) {
      await supabaseAdmin.from("profiles").update({
        denarii: oppProfile.denarii + (won ? 30 : 150),
        reputation: Math.max(0, oppProfile.reputation + (won ? -1 : 6)),
      }).eq("id", opp.owner_id);
    }

    await supabase.from("matches").insert({
      owner_id: userId,
      gladiator_id: g.id,
      opponent_name: `${opp.name} (${oMapLudus(opp.owner_id) ?? "rival ludus"})`,
      opponent_power: oppPower,
      difficulty: "pvp",
      result: won ? "win" : "loss",
      xp_gained: xpGained,
      denarii_gained: denariiGained,
      reputation_gained: repGained,
      log,
    });

    return { won, log, denariiGained, xpGained, repGained };
  });

// helper stub (not used — keep signature consistent)
function oMapLudus(_ownerId: string): string | null { return null; }

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

    const log: string[] = [];
    log.push(`${battle.label} begins. ${team.map(t => t.name).join(", ")} enter the sand.`);
    log.push(`Team power ${teamPower} vs ${enemyPower}.`);

    let teamHp = team.length * 100;
    let enemyHp = team.length * 100;
    for (let i = 1; i <= 6 && teamHp > 0 && enemyHp > 0; i++) {
      const mr = teamPower + rand(0, 60);
      const or = enemyPower + rand(0, 60);
      if (mr > or) { const d = rand(25, 45); enemyHp -= d; log.push(`Round ${i}: your cohort presses for ${d}.`); }
      else { const d = rand(25, 45); teamHp -= d; log.push(`Round ${i}: the enemy strikes for ${d}.`); }
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
