import { createServerFn } from "@tanstack/react-start";
import { getSession, updateSession, clearSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { ADMIN_SESSION_CONFIG, requireAdminAuth, assertAdminConfigured } from "@/integrations/admin/auth-middleware";
import { ARENA_TIERS, TEAM_BATTLES } from "@/lib/game.functions";

// ---------- AUTH ----------
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }).parse(input))
  .handler(async ({ data }) => {
    assertAdminConfigured();
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;
    if (data.username !== validUsername || data.password !== validPassword) {
      throw new Error("Invalid credentials");
    }
    await updateSession(ADMIN_SESSION_CONFIG, { authenticated: true });
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(ADMIN_SESSION_CONFIG);
  return { ok: true };
});

export const adminSessionStatus = createServerFn({ method: "GET" }).handler(async () => {
  assertAdminConfigured();
  const session = await getSession<{ authenticated?: boolean }>(ADMIN_SESSION_CONFIG);
  return { authenticated: !!session.data?.authenticated };
});

// ---------- STATS ----------
// UTC calendar-day bucketing — Supabase returns timestamptz as ISO strings
// with an explicit +00:00 offset, so slicing the date portion is safe.
const dayKey = (iso: string) => iso.slice(0, 10);

function last30DayKeys(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Every meaningful player action (fight, recruit, train, upgrade, Cursus
// Honorum) spends or grants denarii and therefore touches profiles.updated_at
// — so a single "most recent update" timestamp is enough to answer "were they
// active within window X", without needing a full per-day activity log.
function classifyChannel(difficulty: string): string {
  if (difficulty.startsWith("boss:")) return "Boss Fights";
  if (difficulty === "pvp" || difficulty === "pvp_death") return "Rival Ludi (PvP)";
  if (ARENA_TIERS.some(t => t.key === difficulty)) return "Pit Fights";
  if (TEAM_BATTLES.some(t => t.key === difficulty)) return "Team Battles";
  return "Other";
}

export type AdminStats = {
  signupsByDay: { day: string; count: number }[];
  avgGoldPerActivePlayerPerDay: number;
  avgXpPerActiveGladiatorPerDay: number;
  avgCursusHonorumTriggersPerActivePlayerPerDay: number;
  goldByChannel: { channel: string; total: number; pct: number }[];
  dau: number;
  wau: number;
  mau: number;
  retention7d: { cohortSize: number; retainedPct: number } | null;
  windowDays: number;
  sampledAt: string;
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async (): Promise<AdminStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const days = last30DayKeys();
    const daySet = new Set(days);
    const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [profilesRes, matchesRes, socialRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,created_at,updated_at,is_bot"),
      supabaseAdmin.from("matches").select("owner_id,gladiator_id,created_at,denarii_gained,xp_gained,difficulty").gte("created_at", sinceIso),
      supabaseAdmin.from("social_events").select("owner_id,created_at,denarii_delta").gte("created_at", sinceIso),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (matchesRes.error) throw new Error(matchesRes.error.message);
    if (socialRes.error) throw new Error(socialRes.error.message);

    const profiles = profilesRes.data ?? [];
    const matches = matchesRes.data ?? [];
    const socialEvents = socialRes.data ?? [];

    // Bot ludi (profiles.is_bot) exist purely to fill out PvP matchmaking —
    // exclude them from every stat below so they don't skew real activity.
    const botIds = new Set(profiles.filter(p => p.is_bot).map(p => p.id));
    const nonBotMatches = matches.filter(m => !botIds.has(m.owner_id));
    const nonBotSocial = socialEvents.filter(s => !botIds.has(s.owner_id));

    // Signups: real (non-bot) profiles created per UTC day, last 30 days.
    const signupCounts = new Map(days.map(d => [d, 0]));
    for (const p of profiles) {
      if (p.is_bot) continue;
      const d = dayKey(p.created_at);
      if (daySet.has(d)) signupCounts.set(d, (signupCounts.get(d) ?? 0) + 1);
    }
    const signupsByDay = days.map(day => ({ day, count: signupCounts.get(day) ?? 0 }));

    // Gold: sum(matches.denarii_gained) + sum(positive social_events.denarii_delta)
    // / count of distinct (owner_id, day) "player-days" with at least one of
    // those — i.e. average gold earned per day among players who were
    // actually earning that day. Negative Cursus Honorum outcomes (a bad
    // omen costing denarii) aren't "obtained", so only positive deltas count.
    let totalGold = 0;
    const goldPlayerDays = new Set<string>();
    for (const m of nonBotMatches) {
      totalGold += m.denarii_gained ?? 0;
      goldPlayerDays.add(`${m.owner_id}:${dayKey(m.created_at)}`);
    }
    for (const s of nonBotSocial) {
      if (s.denarii_delta > 0) {
        totalGold += s.denarii_delta;
        goldPlayerDays.add(`${s.owner_id}:${dayKey(s.created_at)}`);
      }
    }
    const avgGoldPerActivePlayerPerDay = goldPlayerDays.size > 0 ? totalGold / goldPlayerDays.size : 0;

    // XP: sum(matches.xp_gained) / distinct (gladiator_id, day) "gladiator-days".
    let totalXp = 0;
    const xpGladiatorDays = new Set<string>();
    for (const m of nonBotMatches) {
      totalXp += m.xp_gained ?? 0;
      xpGladiatorDays.add(`${m.gladiator_id}:${dayKey(m.created_at)}`);
    }
    const avgXpPerActiveGladiatorPerDay = xpGladiatorDays.size > 0 ? totalXp / xpGladiatorDays.size : 0;

    // Cursus Honorum: count(social_events) / distinct (owner_id, day)
    // "player-days" that triggered it at least once.
    const cursusPlayerDays = new Set<string>();
    for (const s of nonBotSocial) {
      cursusPlayerDays.add(`${s.owner_id}:${dayKey(s.created_at)}`);
    }
    const avgCursusHonorumTriggersPerActivePlayerPerDay =
      cursusPlayerDays.size > 0 ? nonBotSocial.length / cursusPlayerDays.size : 0;

    // Gold by channel: which activities actually drive the economy.
    const channelTotals = new Map<string, number>();
    for (const m of nonBotMatches) {
      const channel = classifyChannel(m.difficulty);
      channelTotals.set(channel, (channelTotals.get(channel) ?? 0) + (m.denarii_gained ?? 0));
    }
    let cursusGold = 0;
    for (const s of nonBotSocial) if (s.denarii_delta > 0) cursusGold += s.denarii_delta;
    if (cursusGold > 0) channelTotals.set("Cursus Honorum", (channelTotals.get("Cursus Honorum") ?? 0) + cursusGold);
    const grandTotal = [...channelTotals.values()].reduce((a, b) => a + b, 0);
    const goldByChannel = [...channelTotals.entries()]
      .map(([channel, total]) => ({ channel, total, pct: grandTotal > 0 ? (total / grandTotal) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

    // DAU/WAU/MAU from profiles.updated_at — see classifyChannel's neighbor
    // comment above for why one timestamp is enough.
    const nonBotProfiles = profiles.filter(p => !p.is_bot);
    const now = Date.now();
    const dau = nonBotProfiles.filter(p => now - new Date(p.updated_at).getTime() < 86_400_000).length;
    const wau = nonBotProfiles.filter(p => now - new Date(p.updated_at).getTime() < 7 * 86_400_000).length;
    const mau = nonBotProfiles.filter(p => now - new Date(p.updated_at).getTime() < 30 * 86_400_000).length;

    // 7-day retention: of players old enough (joined 8-30 days ago) to have
    // a meaningful "are they still around" answer, what fraction touched
    // their profile at all in the last 7 days.
    const cohort = nonBotProfiles.filter(p => {
      const ageMs = now - new Date(p.created_at).getTime();
      return ageMs >= 8 * 86_400_000 && ageMs <= 30 * 86_400_000;
    });
    const retained = cohort.filter(p => now - new Date(p.updated_at).getTime() < 7 * 86_400_000).length;
    const retention7d = cohort.length > 0 ? { cohortSize: cohort.length, retainedPct: (retained / cohort.length) * 100 } : null;

    return {
      signupsByDay,
      avgGoldPerActivePlayerPerDay,
      avgXpPerActiveGladiatorPerDay,
      avgCursusHonorumTriggersPerActivePlayerPerDay,
      goldByChannel,
      dau,
      wau,
      mau,
      retention7d,
      windowDays: 30,
      sampledAt: new Date().toISOString(),
    };
  });

// ---------- LUDUS LOOKUP ----------
export type AdminLudusSearchResult = {
  id: string;
  ludus_name: string;
  denarii: number;
  reputation: number;
  is_bot: boolean;
  created_at: string;
  updated_at: string;
};

// Case-insensitive substring match on ludus_name — good enough for an admin
// typing a partial/misremembered name, no need for full-text search infra
// at this scale. Capped at 20 results; narrowing the query is the UI, not
// pagination.
export const adminSearchLudi = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input) => z.object({ query: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data }): Promise<{ results: AdminLudusSearchResult[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id,ludus_name,denarii,reputation,is_bot,created_at,updated_at")
      .ilike("ludus_name", `%${data.query}%`)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { results: rows ?? [] };
  });

export type AdminLudusDetail = {
  profile: {
    id: string;
    ludus_name: string;
    denarii: number;
    reputation: number;
    is_bot: boolean;
    created_at: string;
    updated_at: string;
    training_level: number;
    scouting_level: number;
    medicus_level: number;
    armory_level: number;
    pantry_level: number;
    social_level: number;
    relics_level: number;
    hades_keys: number;
  };
  gladiators: {
    id: string;
    name: string;
    class: string;
    weapon_type: string;
    is_beast: boolean;
    level: number;
    status: string;
    wins: number;
    losses: number;
    strength: number;
    agility: number;
    stamina: number;
    technique: number;
    weapon_tier: number;
    armor_tier: number;
  }[];
  recentMatches: {
    id: string;
    created_at: string;
    difficulty: string;
    opponent_name: string;
    result: string;
    denarii_gained: number;
    xp_gained: number;
    gladiator_id: string;
  }[];
  totals: {
    matchCount: number;
    winCount: number;
    totalGoldEarned: number;
    totalXpEarned: number;
  };
};

// Everything shown for one ludus on the admin lookup's detail panel — one
// round trip covering the profile, its full roster, and a recent-activity
// window (last 50 matches). Matches beyond that window still count toward
// nothing here — this is a spot-check tool, not a full audit log.
export const getAdminLudusDetail = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input) => z.object({ ludusId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<AdminLudusDetail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profileRes, gladiatorsRes, matchesRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,ludus_name,denarii,reputation,is_bot,created_at,updated_at,training_level,scouting_level,medicus_level,armory_level,pantry_level,social_level,relics_level,hades_keys")
        .eq("id", data.ludusId)
        .maybeSingle(),
      supabaseAdmin
        .from("gladiators")
        .select("id,name,class,weapon_type,is_beast,level,status,wins,losses,strength,agility,stamina,technique,weapon_tier,armor_tier")
        .eq("owner_id", data.ludusId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("matches")
        .select("id,created_at,difficulty,opponent_name,result,denarii_gained,xp_gained,gladiator_id")
        .eq("owner_id", data.ludusId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (profileRes.error) throw new Error(profileRes.error.message);
    if (!profileRes.data) throw new Error("Ludus not found");
    if (gladiatorsRes.error) throw new Error(gladiatorsRes.error.message);
    if (matchesRes.error) throw new Error(matchesRes.error.message);

    const recentMatches = matchesRes.data ?? [];
    const totals = {
      matchCount: recentMatches.length,
      winCount: recentMatches.filter(m => m.result === "win").length,
      totalGoldEarned: recentMatches.reduce((sum, m) => sum + (m.denarii_gained ?? 0), 0),
      totalXpEarned: recentMatches.reduce((sum, m) => sum + (m.xp_gained ?? 0), 0),
    };

    return {
      profile: profileRes.data,
      gladiators: gladiatorsRes.data ?? [],
      recentMatches,
      totals,
    };
  });
