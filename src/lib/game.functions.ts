import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

// Stat cap grows with training facility
const statCap = (trainingLevel: number) => 15 + trainingLevel * 3; // lvl1=18, lvl5=30

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
    level: number; weapon_tier: number; armor_tier: number; health: number;
    weapon_type: string;
  },
  skillLevel: number,
) {
  const base = 3 * (g.strength + g.agility + g.stamina + g.technique);
  const gear = g.weapon_tier * 12 + g.armor_tier * 9;
  const lvl = g.level * 6;
  const healthMod = g.health / 100;
  const raw = (base + gear + lvl) * healthMod;
  const skillMod = 1 + skillLevel * 0.08; // +8% per skill level for the matching style
  return Math.floor(raw * skillMod);
}

// ---------- READ ----------
export const getLudusState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, gladiators, matches, skills] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("gladiators").select("*").eq("owner_id", userId).order("created_at", { ascending: true }),
      supabase.from("matches").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("ludus_skills").select("*").eq("owner_id", userId),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    return {
      profile: profile.data,
      gladiators: gladiators.data ?? [],
      matches: matches.data ?? [],
      skills: skills.data ?? [],
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
    const { error: insertErr } = await supabase.from("gladiators").insert({ owner_id: userId, ...g });
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
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");

    const cap = statCap(profile.training_level);
    if ((g[data.stat] as number) >= cap) throw new Error(`Stat capped at ${cap} — upgrade Training Yard`);

    // Better training = bigger gains
    const bigChance = 0.2 + profile.training_level * 0.1;
    const gain = Math.random() < bigChance ? 2 : 1;
    const newVal = Math.min(cap, (g[data.stat] as number) + gain);
    const patch =
      data.stat === "strength" ? { strength: newVal } :
      data.stat === "agility" ? { agility: newVal } :
      data.stat === "stamina" ? { stamina: newVal } :
      { technique: newVal };
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
    slot: z.enum(["weapon", "armor"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.is_beast) throw new Error("Beasts do not wear gear");

    const currentTier = data.slot === "weapon" ? g.weapon_tier : g.armor_tier;
    if (currentTier >= 5) throw new Error("Already at max tier");
    const baseCost = 150 * (currentTier + 1);
    const cost = Math.max(50, Math.floor(baseCost * (1 - (profile.armory_level - 1) * 0.1)));
    if (profile.denarii < cost) throw new Error(`Need ${cost} denarii`);

    const patch = data.slot === "weapon" ? { weapon_tier: currentTier + 1 } : { armor_tier: currentTier + 1 };
    const { error } = await supabase.from("gladiators").update(patch).eq("id", g.id);
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
    const missing = 100 - g.health;
    if (missing <= 0 && !g.injury_until) throw new Error("Already at full health");
    const baseCost = Math.max(30, missing * 2);
    const cost = Math.max(15, Math.floor(baseCost * (1 - (profile.medicus_level - 1) * 0.12)));
    if (profile.denarii < cost) throw new Error(`Physician needs ${cost} denarii`);
    const { error } = await supabase.from("gladiators").update({ health: 100, injury_until: null }).eq("id", g.id);
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
    reqFame: 0, reqLevel: 1, reqWins: 0,
    powerScale: 0.80, reward: 70, xp: 35, rep: 1,
    opponents: ["Drunken Brawler", "Runaway Slave", "Village Bully", "Starving Thief"],
  },
  {
    key: "local", label: "Local Games",
    flavor: "Small town munera — a wooden stand and a modest crowd.",
    reqFame: 5, reqLevel: 2, reqWins: 1,
    powerScale: 1.0, reward: 160, xp: 75, rep: 3,
    opponents: ["Provincial Auctoratus", "Retired Legionary", "Pit Veteran", "Ostian Bruiser"],
  },
  {
    key: "provincial", label: "Provincial Munera",
    flavor: "A magistrate's games — proper editors, painted programs, real steel.",
    reqFame: 25, reqLevel: 3, reqWins: 3,
    powerScale: 1.15, reward: 320, xp: 130, rep: 6,
    opponents: ["Praetorian Washout", "Iberian Veteran", "Champion of Ostia", "Nubian Slayer"],
  },
  {
    key: "capua", label: "Grand Games of Capua",
    flavor: "Capua's arena, where fortunes are made and legions bet their pay.",
    reqFame: 75, reqLevel: 5, reqWins: 8,
    powerScale: 1.35, reward: 650, xp: 240, rep: 14,
    opponents: ["Champion of Capua", "The Bloody Bull", "Marcus Ferrus", "The Thracian Wolf"],
  },
  {
    key: "colosseum", label: "Colosseum of Rome",
    flavor: "The Flavian Amphitheatre. Fifty thousand voices thirsting for blood.",
    reqFame: 200, reqLevel: 8, reqWins: 20,
    powerScale: 1.55, reward: 1300, xp: 420, rep: 30,
    opponents: ["Priscus the Undefeated", "Verus of the Palatine", "Flamma Redivivus", "The Iron Senator"],
  },
  {
    key: "emperor", label: "Emperor's Spectacle",
    flavor: "The Emperor himself watches. Death here becomes legend.",
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
