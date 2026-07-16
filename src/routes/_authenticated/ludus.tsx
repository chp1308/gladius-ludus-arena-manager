import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLudusState, recruitGladiator, trainGladiator, upgradeEquipment,
  healGladiator, dismissGladiator,
  upgradeFacility, upgradeSkill, WEAPON_LABELS,
  ARENA_TIERS,
} from "@/lib/game.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Coins, Swords, Shield, Heart, X, Skull, Award, Dumbbell, Search, Cross, Hammer, Cat, HardHat, Footprints, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ludus")({
  component: LudusPage,
});

type State = Awaited<ReturnType<typeof getLudusState>>;
type Gladiator = State["gladiators"][number];

const FACILITIES = [
  { key: "training", label: "Training Yard", desc: "Cheaper drills, bigger stat gains, higher stat cap", icon: Dumbbell },
  { key: "scouting", label: "Scouting Network", desc: "Better recruits, higher chance of beasts", icon: Search },
  { key: "medicus", label: "Valetudinarium", desc: "Cheaper healing, shorter injuries", icon: Cross },
  { key: "armory", label: "Armory", desc: "Cheaper weapon & armor upgrades", icon: Hammer },
] as const;

const SKILL_TREE = [
  { key: "gladius", label: "Gladius & Shield" },
  { key: "spear", label: "Spear" },
  { key: "net", label: "Net & Trident" },
  { key: "dual", label: "Dual Blades" },
  { key: "beast_lion", label: "Lion Handling" },
  { key: "beast_tiger", label: "Tiger Handling" },
] as const;

function facilityCost(curr: number) { return 500 * (curr + 1); }
function skillCost(curr: number) { return 200 * (curr + 1); }

function LudusPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchState = useServerFn(getLudusState);
  const { data } = useSuspenseQuery({ queryKey: ["ludus"], queryFn: () => fetchState() });

  const recruit = useServerFn(recruitGladiator);
  const recruitMut = useMutation({
    mutationFn: () => recruit(),
    onSuccess: (r) => {
      toast.success(r.isBeast ? `A ${r.name} was captured in the wilds!` : `${r.name} joins your ludus.`);
      qc.invalidateQueries({ queryKey: ["ludus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const denarii = data.profile?.denarii ?? 0;
  const scoutingLevel = data.profile?.scouting_level ?? 1;
  const recruitCost = Math.max(60, 100 - (scoutingLevel - 1) * 10);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="font-display text-xl tracking-widest text-primary">{data.profile?.ludus_name ?? "Ludus"}</div>
            <div className="mt-1 flex items-center gap-4 text-sm font-serif italic text-muted-foreground">
              <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-accent" /> {denarii} denarii</span>
              <span className="flex items-center gap-1"><Award className="h-4 w-4 text-accent" /> {data.profile?.reputation ?? 0} fame</span>
              <span>{data.gladiators.length} gladiators</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/arena"><Button size="sm"><Swords className="mr-1 h-4 w-4" /> Arena</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="ludus" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="ludus">Ludus</TabsTrigger>
            <TabsTrigger value="recruit">Recruit</TabsTrigger>
            <TabsTrigger value="facilities">Facilities</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="history">Chronicle</TabsTrigger>
          </TabsList>

          <TabsContent value="ludus" className="mt-6">
            {data.gladiators.length === 0 ? (
              <div className="inscribed ornate-border rounded-lg p-12 text-center">
                <p className="font-serif text-lg italic text-muted-foreground">Your ludus is empty. Recruit your first gladiator.</p>
              </div>
            ) : (
              <GladiatorGrid state={data} />
            )}
          </TabsContent>

          <TabsContent value="recruit" className="mt-6">
            <Card className="inscribed ornate-border">
              <CardHeader>
                <CardTitle className="font-display">The Slave Market</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-serif italic text-muted-foreground">
                  Send your scouts to the provinces. Better scouting brings stronger recruits — and, if fortune favors you, a captured lion or tiger.
                </p>
                <div className="text-sm text-muted-foreground">
                  Scouting Network — <span className="text-accent">Lv {scoutingLevel}</span> · beast chance ~{Math.round(Math.min(0.02 + scoutingLevel * 0.03, 0.2) * 100)}%
                </div>
                <Button
                  size="lg"
                  onClick={() => recruitMut.mutate()}
                  disabled={recruitMut.isPending || denarii < recruitCost}
                >
                  Scout recruit · {recruitCost} denarii
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="facilities" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {FACILITIES.map((f) => (
                <FacilityCard
                  key={f.key}
                  facility={f.key}
                  label={f.label}
                  desc={f.desc}
                  Icon={f.icon}
                  level={data.profile?.[`${f.key}_level` as `training_level`] ?? 1}
                  denarii={denarii}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="skills" className="mt-6">
            <p className="mb-4 font-serif italic text-muted-foreground">
              Master a fighting style — each rank grants +8% combat power to gladiators using that weapon.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {SKILL_TREE.map((s) => {
                const level = data.skills.find(x => x.weapon_type === s.key)?.level ?? 0;
                return <SkillCard key={s.key} weaponType={s.key} label={s.label} level={level} denarii={denarii} />;
              })}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card className="inscribed ornate-border">
              <CardHeader><CardTitle className="font-display">Chronicle of the Arena</CardTitle></CardHeader>
              <CardContent>
                {data.matches.length === 0 ? (
                  <p className="font-serif italic text-muted-foreground">No matches yet. Send a gladiator to the sand.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.matches.map((m) => {
                      const g = data.gladiators.find(x => x.id === m.gladiator_id);
                      return (
                        <li key={m.id} className="flex items-center justify-between py-3">
                          <div>
                            <div className="font-serif text-base">
                              <span className={m.result === "win" ? "text-primary font-semibold" : "text-muted-foreground"}>
                                {m.result === "win" ? "Victory" : "Defeat"}
                              </span>
                              {" — "}
                              {g?.name ?? "Fallen"} vs {m.opponent_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ARENA_TIERS.find(t => t.key === m.difficulty)?.label ?? m.difficulty} · {new Date(m.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-accent">+{m.denarii_gained} denarii</div>
                            <div className="text-muted-foreground">+{m.xp_gained} XP</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FacilityCard({
  facility, label, desc, Icon, level, denarii,
}: {
  facility: "training" | "scouting" | "medicus" | "armory";
  label: string; desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  level: number; denarii: number;
}) {
  const qc = useQueryClient();
  const upgrade = useServerFn(upgradeFacility);
  const mut = useMutation({
    mutationFn: () => upgrade({ data: { facility } }),
    onSuccess: (r) => { toast.success(`${label} → Lv ${r.newLevel}`); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const atMax = level >= 5;
  const cost = facilityCost(level);
  return (
    <Card className="inscribed ornate-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Icon className="h-5 w-5 text-primary" /> {label}
          </CardTitle>
          <Badge className="bg-accent text-accent-foreground">Lv {level}/5</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-serif text-sm italic text-muted-foreground">{desc}</p>
        <Button
          className="w-full"
          size="sm"
          disabled={atMax || mut.isPending || denarii < cost}
          onClick={() => mut.mutate()}
        >
          {atMax ? "Maxed" : `Upgrade · ${cost} denarii`}
        </Button>
      </CardContent>
    </Card>
  );
}

function SkillCard({
  weaponType, label, level, denarii,
}: {
  weaponType: "gladius" | "spear" | "net" | "dual" | "beast_lion" | "beast_tiger";
  label: string; level: number; denarii: number;
}) {
  const qc = useQueryClient();
  const upgrade = useServerFn(upgradeSkill);
  const mut = useMutation({
    mutationFn: () => upgrade({ data: { weaponType } }),
    onSuccess: (r) => { toast.success(`${label} → Rank ${r.newLevel}`); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const atMax = level >= 5;
  const cost = skillCost(level);
  const isBeast = weaponType.startsWith("beast");
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
      <div>
        <div className="flex items-center gap-2 font-display">
          {isBeast ? <Cat className="h-4 w-4 text-accent" /> : <Swords className="h-4 w-4 text-primary" />}
          {label}
        </div>
        <div className="mt-0.5 text-xs text-accent">{"★".repeat(level)}{"☆".repeat(5 - level)}  <span className="text-muted-foreground">+{level * 8}% power</span></div>
      </div>
      <Button size="sm" variant="outline"
        disabled={atMax || mut.isPending || denarii < cost}
        onClick={() => mut.mutate()}>
        {atMax ? "Mastered" : `${cost}d`}
      </Button>
    </div>
  );
}

function GladiatorCard({ g, state }: { g: Gladiator; state: State }) {
  const qc = useQueryClient();
  const train = useServerFn(trainGladiator);
  const upgrade = useServerFn(upgradeEquipment);
  const heal = useServerFn(healGladiator);
  const dismiss = useServerFn(dismissGladiator);

  const injured = g.injury_until && new Date(g.injury_until) > new Date();
  const injuryDaysLeft = injured ? Math.ceil((new Date(g.injury_until!).getTime() - Date.now()) / 86400_000) : 0;
  const skillLevel = state.skills.find(s => s.weapon_type === g.weapon_type)?.level ?? 0;
  const trainingLevel = state.profile?.training_level ?? 1;
  const statCap = 15 + trainingLevel * 3;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ludus"] });

  const trainMut = useMutation({
    mutationFn: (stat: "strength" | "agility" | "stamina" | "technique") =>
      train({ data: { gladiatorId: g.id, stat } }),
    onSuccess: (r) => { toast.success(`+${r.gain} ${r.stat}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const upgradeMut = useMutation({
    mutationFn: (slot: "weapon" | "armor") => upgrade({ data: { gladiatorId: g.id, slot } }),
    onSuccess: () => { toast.success("Equipment upgraded"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const healMut = useMutation({
    mutationFn: () => heal({ data: { gladiatorId: g.id } }),
    onSuccess: (r) => { toast.success(`Healed for ${r.cost} denarii`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dismissMut = useMutation({
    mutationFn: () => dismiss({ data: { gladiatorId: g.id } }),
    onSuccess: () => { toast.success("Gladiator dismissed"); invalidate(); },
  });

  const stats: [string, number, "strength" | "agility" | "stamina" | "technique"][] = [
    ["STR", g.strength, "strength"],
    ["AGI", g.agility, "agility"],
    ["STA", g.stamina, "stamina"],
    ["TEC", g.technique, "technique"],
  ];

  return (
    <Card className="inscribed ornate-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              {g.is_beast && <Cat className="h-5 w-5 text-accent" />}
              {g.name}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{g.class}</Badge>
              <Badge variant="secondary">{WEAPON_LABELS[g.weapon_type] ?? g.weapon_type}{skillLevel > 0 ? ` · ★${skillLevel}` : ""}</Badge>
              <span className="font-serif italic text-muted-foreground">of {g.origin}</span>
              <Badge className="bg-accent text-accent-foreground">Lv {g.level}</Badge>
              <span className="text-muted-foreground">{g.wins}W / {g.losses}L</span>
            </div>
          </div>
          <button onClick={() => { if (confirm(`Dismiss ${g.name}?`)) dismissMut.mutate(); }} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> Health</span>
            <span>{g.health}/100</span>
          </div>
          <Progress value={g.health} className="h-2" />
          {injured && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <Skull className="h-3 w-3" /> Injured — {injuryDaysLeft}d until recovery
            </p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>XP</span>
            <span>{g.experience} / {g.level * 100}</span>
          </div>
          <Progress value={(g.experience / (g.level * 100)) * 100} className="h-1.5" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {stats.map(([label, val, key]) => {
            const capped = val >= statCap;
            return (
              <button
                key={key}
                onClick={() => trainMut.mutate(key)}
                disabled={trainMut.isPending || !!injured || capped}
                className="rounded border border-border bg-secondary/40 p-2 text-center transition hover:border-primary hover:bg-secondary disabled:opacity-50"
                title={capped ? `Capped at ${statCap} — upgrade Training Yard` : "Train"}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="font-display text-lg">{val}<span className="text-[10px] text-muted-foreground">/{statCap}</span></div>
              </button>
            );
          })}
        </div>

        {!g.is_beast && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => upgradeMut.mutate("weapon")}
              disabled={upgradeMut.isPending || g.weapon_tier >= 5}
              className="flex items-center justify-between rounded border border-border p-2 hover:border-primary disabled:opacity-50"
            >
              <span className="flex items-center gap-1"><Swords className="h-3 w-3" /> Weapon</span>
              <span className="text-accent">{"★".repeat(g.weapon_tier)}{"☆".repeat(5 - g.weapon_tier)}</span>
            </button>
            <button
              onClick={() => upgradeMut.mutate("armor")}
              disabled={upgradeMut.isPending || g.armor_tier >= 5}
              className="flex items-center justify-between rounded border border-border p-2 hover:border-primary disabled:opacity-50"
            >
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Armor</span>
              <span className="text-accent">{"★".repeat(g.armor_tier)}{"☆".repeat(5 - g.armor_tier)}</span>
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link
            to="/arena"
            className={`flex-1 ${(!!injured || g.health < 30) ? "pointer-events-none opacity-50" : ""}`}
          >
            <Button size="sm" className="w-full" disabled={!!injured || g.health < 30}>
              <Swords className="mr-1 h-4 w-4" /> To the Arena
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => healMut.mutate()} disabled={healMut.isPending || (g.health === 100 && !injured)}>
            <Heart className="mr-1 h-4 w-4" /> Heal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
