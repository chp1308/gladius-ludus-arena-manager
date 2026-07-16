import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ORIGINS = ["Thrace", "Gaul", "Nubia", "Britannia", "Germania", "Hispania", "Syria", "Numidia"];
const CLASSES = ["Murmillo", "Retiarius", "Thraex", "Secutor", "Hoplomachus", "Dimachaerus"];
const PRAENOMEN = ["Marcus", "Quintus", "Lucius", "Titus", "Gaius", "Aulus", "Decimus", "Publius", "Spurius", "Crixus", "Priscus", "Verus", "Flamma", "Spartacus", "Hermes", "Tetraites"];
const COGNOMEN = ["the Bull", "the Wolf", "the Swift", "the Iron", "of Capua", "the Younger", "Ferrus", "Magnus", "the Silent", "the Grim", "the Fair", "Invictus", ""];

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function generateGladiator() {
  const name = `${pick(PRAENOMEN)}${Math.random() < 0.5 ? " " + pick(COGNOMEN) : ""}`.trim();
  return {
    name,
    origin: pick(ORIGINS),
    class: pick(CLASSES),
    strength: rand(4, 9),
    agility: rand(4, 9),
    stamina: rand(4, 9),
    technique: rand(3, 8),
  };
}

function gladiatorPower(g: {
  strength: number; agility: number; stamina: number; technique: number;
  level: number; weapon_tier: number; armor_tier: number; health: number;
}) {
  const base = 3 * (g.strength + g.agility + g.stamina + g.technique);
  const gear = g.weapon_tier * 12 + g.armor_tier * 9;
  const lvl = g.level * 6;
  const healthMod = g.health / 100;
  return Math.floor((base + gear + lvl) * healthMod);
}

// ---------- READ ----------
export const getLudusState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, gladiators, matches] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("gladiators").select("*").eq("owner_id", userId).order("created_at", { ascending: true }),
      supabase.from("matches").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    return {
      profile: profile.data,
      gladiators: gladiators.data ?? [],
      matches: matches.data ?? [],
    };
  });

// ---------- RECRUIT ----------
export const recruitGladiator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const COST = 100;
    const { data: profile } = await supabase.from("profiles").select("denarii").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    if (profile.denarii < COST) throw new Error("Not enough denarii");

    const g = generateGladiator();
    const { error: insertErr } = await supabase.from("gladiators").insert({ owner_id: userId, ...g });
    if (insertErr) throw new Error(insertErr.message);
    const { error: updErr } = await supabase.from("profiles").update({ denarii: profile.denarii - COST }).eq("id", userId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
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
    const COST = 50;
    const { data: profile } = await supabase.from("profiles").select("denarii").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    if (profile.denarii < COST) throw new Error("Not enough denarii");

    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    if (g[data.stat] >= 20) throw new Error("Stat is maxed");

    const gain = Math.random() < 0.7 ? 1 : 2;
    const newVal = (g[data.stat] as number) + gain;
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
    const { data: profile } = await supabase.from("profiles").select("denarii").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");

    const currentTier = data.slot === "weapon" ? g.weapon_tier : g.armor_tier;
    if (currentTier >= 5) throw new Error("Already at max tier");
    const cost = 150 * (currentTier + 1);
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
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    const missing = 100 - g.health;
    if (missing <= 0 && !g.injury_until) throw new Error("Already at full health");
    const cost = Math.max(30, missing * 2);
    const { data: profile } = await supabase.from("profiles").select("denarii").eq("id", userId).maybeSingle();
    if (!profile || profile.denarii < cost) throw new Error(`Physician needs ${cost} denarii`);
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

// ---------- FIGHT ----------
export const fightMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gladiatorId: z.string().uuid(),
    difficulty: z.enum(["novice", "veteran", "champion"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase.from("gladiators").select("*").eq("id", data.gladiatorId).eq("owner_id", userId).maybeSingle();
    if (!g) throw new Error("Gladiator not found");
    if (g.injury_until && new Date(g.injury_until) > new Date()) throw new Error("Gladiator is injured");
    if (g.health < 30) throw new Error("Gladiator too wounded to fight");

    const myPower = gladiatorPower(g);
    const scale = data.difficulty === "novice" ? 0.85 : data.difficulty === "veteran" ? 1.05 : 1.3;
    const opponentPower = Math.floor(myPower * scale + rand(-15, 15));
    const opponentName = `${pick(PRAENOMEN)} ${pick(COGNOMEN)}`.trim();

    const log: string[] = [];
    log.push(`${g.name} enters the arena to face ${opponentName}.`);
    log.push(`The crowd roars. Power ${myPower} vs ${opponentPower}.`);

    // Simulate 3-5 exchanges
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
    const rewardBase = data.difficulty === "novice" ? 80 : data.difficulty === "veteran" ? 180 : 400;
    const xpBase = data.difficulty === "novice" ? 40 : data.difficulty === "veteran" ? 90 : 180;
    const denariiGained = won ? rewardBase + rand(0, 40) : Math.floor(rewardBase * 0.15);
    const xpGained = won ? xpBase : Math.floor(xpBase * 0.4);
    const repGained = won ? (data.difficulty === "novice" ? 1 : data.difficulty === "veteran" ? 3 : 8) : 0;

    const damageTaken = Math.max(5, 100 - Math.max(0, myHp));
    const newHealth = Math.max(0, g.health - damageTaken);
    let injuryUntil: string | null = null;
    if (newHealth <= 0) {
      log.push(`${g.name} falls, gravely wounded. Weeks in the valetudinarium await.`);
    } else if (damageTaken > 60) {
      const days = rand(2, 4);
      injuryUntil = new Date(Date.now() + days * 86400_000).toISOString();
      log.push(`${g.name} is injured — cannot fight for a time.`);
    }

    log.push(won
      ? `Victory! The crowd showers ${g.name} with praise. +${denariiGained} denarii, +${xpGained} XP.`
      : `Defeat. ${g.name} limps from the sand. +${denariiGained} denarii.`);

    // Level up
    const newXp = g.experience + xpGained;
    const xpForNext = g.level * 100;
    let newLevel = g.level;
    let finalXp = newXp;
    if (newXp >= xpForNext) {
      newLevel = g.level + 1;
      finalXp = newXp - xpForNext;
      log.push(`⚔ ${g.name} advances to level ${newLevel}!`);
    }

    const gladPatch: Record<string, unknown> = {
      health: newHealth,
      injury_until: injuryUntil,
      experience: finalXp,
      level: newLevel,
      wins: g.wins + (won ? 1 : 0),
      losses: g.losses + (won ? 0 : 1),
    };

    const { error: gErr } = await supabase.from("gladiators").update(gladPatch).eq("id", g.id);
    if (gErr) throw new Error(gErr.message);

    const { data: profile } = await supabase.from("profiles").select("denarii, reputation").eq("id", userId).maybeSingle();
    if (profile) {
      await supabase.from("profiles").update({
        denarii: profile.denarii + denariiGained,
        reputation: profile.reputation + repGained,
      }).eq("id", userId);
    }

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
