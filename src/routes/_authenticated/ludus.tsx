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
import { Coins, Swords, Sword, Shield, ShieldHalf, Heart, X, Skull, Award, Dumbbell, Search, Cross, Hammer, Cat, HardHat, Footprints } from "lucide-react";

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

function GladiatorGrid({ state }: { state: State }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = state.gladiators.find(g => g.id === openId) ?? null;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.gladiators.map((g) => (
          <GladiatorTile key={g.id} g={g} onClick={() => setOpenId(g.id)} />
        ))}
      </div>
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
        <DialogContent className="max-w-3xl">
          {selected && <GladiatorSheet g={selected} state={state} onClose={() => setOpenId(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GladiatorTile({ g, onClick }: { g: Gladiator; onClick: () => void }) {
  const injured = g.injury_until && new Date(g.injury_until) > new Date();
  return (
    <button
      onClick={onClick}
      className="inscribed ornate-border rounded-lg p-4 text-left transition hover:border-primary"
    >
      <div className="flex items-center gap-3">
        <FaceAvatar g={g} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate font-display text-base">
            {g.is_beast && <Cat className="h-4 w-4 text-accent" />}
            {g.name}
          </div>
          <div className="text-xs text-muted-foreground">
            Lv {g.level} · {g.wins}W/{g.losses}L · {WEAPON_LABELS[g.weapon_type] ?? g.weapon_type}
          </div>
        </div>
        <Badge className="bg-accent text-accent-foreground">Lv {g.level}</Badge>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> HP</span>
          <span>{g.health}/100{injured ? " · Injured" : ""}</span>
        </div>
        <Progress value={g.health} className="h-1.5" />
      </div>
    </button>
  );
}

// Deterministic PRNG from a string
function seedFrom(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Procedurally generated portrait — SVG bust with varied skin, hair, beard, eyes.
function FaceAvatar({ g, size = 96 }: { g: Gladiator; size?: number }) {
  if (g.is_beast) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-accent/60 bg-gradient-to-br from-accent/30 to-primary/20"
        style={{ width: size, height: size }}
      >
        <Cat className="text-accent" style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
    );
  }
  const rng = seedFrom(g.name + "|" + g.origin);
  const skins = ["#f0c9a5", "#e0b088", "#c48c67", "#a0704f", "#7a4f31", "#5a3620"];
  const hairs = ["#1a1208", "#2b1a0d", "#3a2416", "#5a3a1a", "#8a5a2a", "#c89a4a", "#e3d5b0", "#7a7a7a"];
  const eyes  = ["#3a2a1a", "#5a3a20", "#3a5a3a", "#2a4a6a", "#4a3a2a"];
  const skin = skins[Math.floor(rng() * skins.length)];
  const hair = hairs[Math.floor(rng() * hairs.length)];
  const eye  = eyes[Math.floor(rng() * eyes.length)];
  const beard = rng() < 0.55;
  const helmet = rng() < 0.25;
  const scar = rng() < 0.3;
  const noseW = 4 + rng() * 3;
  const mouthCurve = rng() < 0.7 ? 2 : -1; // mostly stern

  const s = size;
  return (
    <div
      className="relative overflow-hidden rounded-full border border-primary/50 shadow-inner"
      style={{ width: s, height: s, background: "radial-gradient(circle at 30% 25%, hsl(35 25% 22%), hsl(20 30% 10%))" }}
    >
      <svg viewBox="0 0 100 100" width={s} height={s} shapeRendering="geometricPrecision">
        {/* shoulders / tunic */}
        <path d="M5 100 Q 50 65 95 100 Z" fill="#3b2a1c" />
        <path d="M20 92 Q 50 78 80 92 L 80 100 L 20 100 Z" fill="#8b1a1a" opacity="0.7" />
        {/* neck */}
        <rect x="42" y="60" width="16" height="14" fill={skin} />
        {/* head */}
        <ellipse cx="50" cy="45" rx="22" ry="26" fill={skin} />
        {/* jaw shadow */}
        <path d="M28 48 Q 50 78 72 48" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        {/* hair */}
        {!helmet && (
          <path d={`M28 38 Q 30 20 50 18 Q 70 20 72 38 Q 68 30 50 28 Q 32 30 28 38 Z`} fill={hair} />
        )}
        {helmet && (
          <>
            <path d="M26 42 Q 26 18 50 16 Q 74 18 74 42 L 72 44 Q 50 32 28 44 Z" fill="#8a7a4a" stroke="#5a4a20" strokeWidth="1" />
            <rect x="48" y="14" width="4" height="10" fill="#b22222" />
            <path d="M46 12 Q 50 4 54 12 Q 60 8 58 18 Q 50 14 42 18 Q 40 8 46 12 Z" fill="#b22222" />
          </>
        )}
        {/* eyes */}
        <ellipse cx="41" cy="46" rx="2.6" ry="1.8" fill="#fff" />
        <ellipse cx="59" cy="46" rx="2.6" ry="1.8" fill="#fff" />
        <circle cx="41" cy="46" r="1.3" fill={eye} />
        <circle cx="59" cy="46" r="1.3" fill={eye} />
        {/* brows */}
        <path d="M37 42 L 45 41" stroke={hair} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M55 41 L 63 42" stroke={hair} strokeWidth="1.6" strokeLinecap="round" />
        {/* nose */}
        <path d={`M50 48 Q ${50 - noseW / 2} 54 50 57 Q ${50 + noseW / 2} 54 50 48`} fill="rgba(0,0,0,0.15)" />
        {/* mouth */}
        <path d={`M44 62 Q 50 ${62 + mouthCurve} 56 62`} stroke="#3a1a1a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* beard */}
        {beard && (
          <path d="M32 55 Q 34 72 50 74 Q 66 72 68 55 Q 60 66 50 66 Q 40 66 32 55 Z" fill={hair} opacity="0.85" />
        )}
        {/* scar */}
        {scar && <path d="M40 38 L 44 52" stroke="#6a2a1a" strokeWidth="0.8" />}
      </svg>
    </div>
  );
}

type SlotKey = "helmet" | "armor" | "legs" | "weapon" | "offhand";
type SlotIconProps = { className?: string };

// Per weapon_type, main-hand and off-hand slots reflect what the class actually wields.
type WeaponLoadout = {
  weapon: { label: string; Icon: React.ComponentType<SlotIconProps> };
  offhand: { label: string; Icon: React.ComponentType<SlotIconProps> } | null;
};
const LOADOUTS: Record<string, WeaponLoadout> = {
  gladius: { weapon: { label: "Gladius", Icon: Sword }, offhand: { label: "Scutum", Icon: Shield } },
  spear:   { weapon: { label: "Spear",   Icon: SpearIcon }, offhand: { label: "Parma", Icon: ShieldHalf } },
  net:     { weapon: { label: "Trident", Icon: TridentIcon }, offhand: { label: "Net", Icon: NetIcon } },
  dual:    { weapon: { label: "Sword",   Icon: Sword }, offhand: { label: "Sword", Icon: Sword } },
};
function loadoutFor(weaponType: string): WeaponLoadout {
  return LOADOUTS[weaponType] ?? { weapon: { label: "Weapon", Icon: Swords }, offhand: { label: "Off-hand", Icon: Shield } };
}

function SpearIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 L 20 4" />
      <path d="M20 4 L 15 4 L 20 9 Z" fill="currentColor" />
      <path d="M6 18 L 3 21" />
    </svg>
  );
}
function TridentIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22 L 12 10" />
      <path d="M6 8 L 6 3 M12 8 L 12 2 M18 8 L 18 3" />
      <path d="M4 8 L 20 8" />
      <path d="M9 12 L 15 12" />
    </svg>
  );
}
function NetIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12 H21 M12 3 V21 M5 5 L 19 19 M19 5 L 5 19" />
    </svg>
  );
}

const SLOTS: { key: SlotKey; label: string; Icon: React.ComponentType<SlotIconProps>; tierField: keyof Gladiator }[] = [
  { key: "helmet",  label: "Helmet",   Icon: HardHat,    tierField: "helmet_tier" as keyof Gladiator },
  { key: "armor",   label: "Cuirass",  Icon: Shield,     tierField: "armor_tier" },
  { key: "legs",    label: "Greaves",  Icon: Footprints, tierField: "legs_tier" as keyof Gladiator },
  { key: "weapon",  label: "Weapon",   Icon: Swords,     tierField: "weapon_tier" },
  { key: "offhand", label: "Off-hand", Icon: Shield,     tierField: "offhand_tier" as keyof Gladiator },
];

function GladiatorSheet({ g, state, onClose }: { g: Gladiator; state: State; onClose: () => void }) {
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
    mutationFn: (slot: SlotKey) => upgrade({ data: { gladiatorId: g.id, slot } }),
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
    onSuccess: () => { toast.success("Gladiator dismissed"); invalidate(); onClose(); },
  });

  const stats: [string, number, "strength" | "agility" | "stamina" | "technique"][] = [
    ["STR", g.strength, "strength"],
    ["AGI", g.agility, "agility"],
    ["STA", g.stamina, "stamina"],
    ["TEC", g.technique, "technique"],
  ];

  const getTier = (field: keyof Gladiator) => (g[field] as number | null | undefined) ?? 1;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-2xl">
          {g.is_beast && <Cat className="h-6 w-6 text-accent" />}
          {g.name}
        </DialogTitle>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{g.class}</Badge>
          <Badge variant="secondary">{WEAPON_LABELS[g.weapon_type] ?? g.weapon_type}{skillLevel > 0 ? ` · ★${skillLevel}` : ""}</Badge>
          <span className="font-serif italic text-muted-foreground">of {g.origin}</span>
          <Badge className="bg-accent text-accent-foreground">Lv {g.level}</Badge>
          <span className="text-muted-foreground">{g.wins}W / {g.losses}L</span>
        </div>
      </DialogHeader>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Paperdoll */}
        <div className="ornate-border rounded-lg bg-gradient-to-b from-secondary/40 to-background/60 p-4">
          <div className="grid grid-cols-3 items-center justify-items-center gap-3">
            {/* row 1 */}
            <div />
            <SlotButton
              slot={SLOTS[0]}
              tier={getTier(SLOTS[0].tierField)}
              disabled={g.is_beast || upgradeMut.isPending}
              onClick={() => upgradeMut.mutate("helmet")}
            />
            <div />

            {/* row 2: weapon (main-hand, viewer left = character's right) · face · offhand */}
            {(() => {
              const lo = loadoutFor(g.weapon_type);
              const weaponSlot = { ...SLOTS[3], label: lo.weapon.label, Icon: lo.weapon.Icon };
              const offhandSlot = lo.offhand
                ? { ...SLOTS[4], label: lo.offhand.label, Icon: lo.offhand.Icon }
                : null;
              return (
                <>
                  <SlotButton
                    slot={weaponSlot}
                    tier={getTier(SLOTS[3].tierField)}
                    disabled={g.is_beast || upgradeMut.isPending}
                    onClick={() => upgradeMut.mutate("weapon")}
                  />
                  <FaceAvatar g={g} size={110} />
                  {offhandSlot ? (
                    <SlotButton
                      slot={offhandSlot}
                      tier={getTier(SLOTS[4].tierField)}
                      disabled={g.is_beast || upgradeMut.isPending}
                      onClick={() => upgradeMut.mutate("offhand")}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center text-[10px] italic text-muted-foreground">
                      two-handed
                    </div>
                  )}
                </>
              );
            })()}

            {/* row 3 */}
            <div />
            <SlotButton
              slot={SLOTS[1]}
              tier={getTier(SLOTS[1].tierField)}
              disabled={g.is_beast || upgradeMut.isPending}
              onClick={() => upgradeMut.mutate("armor")}
            />
            <div />

            {/* row 4 */}
            <div />
            <SlotButton
              slot={SLOTS[2]}
              tier={getTier(SLOTS[2].tierField)}
              disabled={g.is_beast || upgradeMut.isPending}
              onClick={() => upgradeMut.mutate("legs")}
            />
            <div />
          </div>
          {g.is_beast && (
            <p className="mt-3 text-center font-serif text-xs italic text-muted-foreground">Beasts fight with tooth and claw — no gear.</p>
          )}
        </div>

        {/* Right side: vitals, stats, actions */}
        <div className="space-y-4">
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

          <div className="flex flex-wrap gap-2 pt-1">
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
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm(`Dismiss ${g.name}?`)) dismissMut.mutate(); }}
            >
              <X className="mr-1 h-4 w-4" /> Dismiss
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function SlotButton({
  slot, tier, disabled, onClick,
}: {
  slot: { key: SlotKey; label: string; Icon: React.ComponentType<SlotIconProps> };
  tier: number; disabled: boolean; onClick: () => void;
}) {
  const atMax = tier >= 5;
  const { Icon, label } = slot;
  return (
    <button
      onClick={onClick}
      disabled={disabled || atMax}
      title={atMax ? `${label} — mastercraft` : `Upgrade ${label}`}
      className="group flex h-20 w-20 flex-col items-center justify-center rounded-md border border-border bg-card/60 p-1 text-center transition hover:border-primary disabled:opacity-60"
    >
      <Icon className="h-5 w-5 text-primary group-hover:text-accent" />
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[10px] leading-none text-accent">{"★".repeat(tier)}<span className="text-muted-foreground">{"☆".repeat(5 - tier)}</span></div>
    </button>
  );
}
