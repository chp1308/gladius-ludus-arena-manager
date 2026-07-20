import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLudusState, recruitGladiator, trainGladiator, upgradeEquipment,
  healGladiator, dismissGladiator, honorGladiator,
  upgradeFacility, upgradeSkill, updateLudusDescription, WEAPON_LABELS,
  ARENA_TIERS, statCap, maxHealth, trainCost, gearCost, pantryCapacity, gladiatorPower,
} from "@/lib/game.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_GEAR_TIER, requiredArmoryLevel } from "@/lib/game.functions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Coins, Swords, Sword, Shield, ShieldHalf, Heart, X, Skull, Award, Dumbbell, Search, Cross, Hammer, Cat, HardHat, Footprints, Flame, Home, ScrollText, Users, BookOpen, Lock, Trophy, Wheat } from "lucide-react";
import cityBg from "@/assets/ludus/city-bg.jpg";
import bLudus from "@/assets/ludus/b-ludus.png";
import bMarket from "@/assets/ludus/b-market.png";
import bTraining from "@/assets/ludus/b-training.png";
import bScouting from "@/assets/ludus/b-scouting.png";
import bMedicus from "@/assets/ludus/b-medicus.png";
import bArmory from "@/assets/ludus/b-armory.png";
import bStudy from "@/assets/ludus/b-study.png";
import bTemple from "@/assets/ludus/b-temple.png";
import bChronicle from "@/assets/ludus/b-chronicle.png";
import bPantry from "@/assets/ludus/b-pantry.png";

// gear tier art — 4 visual grades map to tiers 1-2 / 3-4 / 5-6 / 7-8
import helmet1 from "@/assets/gear/helmet-1.png";
import helmet2 from "@/assets/gear/helmet-2.png";
import helmet3 from "@/assets/gear/helmet-3.png";
import helmet4 from "@/assets/gear/helmet-4.png";
import cuirass1 from "@/assets/gear/cuirass-1.png";
import cuirass2 from "@/assets/gear/cuirass-2.png";
import cuirass3 from "@/assets/gear/cuirass-3.png";
import cuirass4 from "@/assets/gear/cuirass-4.png";
import greaves1 from "@/assets/gear/greaves-1.png";
import greaves2 from "@/assets/gear/greaves-2.png";
import greaves3 from "@/assets/gear/greaves-3.png";
import greaves4 from "@/assets/gear/greaves-4.png";
import gladius1 from "@/assets/gear/gladius-1.png";
import gladius2 from "@/assets/gear/gladius-2.png";
import gladius3 from "@/assets/gear/gladius-3.png";
import gladius4 from "@/assets/gear/gladius-4.png";
import spear1 from "@/assets/gear/spear-1.png";
import spear2 from "@/assets/gear/spear-2.png";
import spear3 from "@/assets/gear/spear-3.png";
import spear4 from "@/assets/gear/spear-4.png";
import trident1 from "@/assets/gear/trident-1.png";
import trident2 from "@/assets/gear/trident-2.png";
import trident3 from "@/assets/gear/trident-3.png";
import trident4 from "@/assets/gear/trident-4.png";
import net1 from "@/assets/gear/net-1.png";
import net2 from "@/assets/gear/net-2.png";
import net3 from "@/assets/gear/net-3.png";
import net4 from "@/assets/gear/net-4.png";
import scutum1 from "@/assets/gear/scutum-1.png";
import scutum2 from "@/assets/gear/scutum-2.png";
import scutum3 from "@/assets/gear/scutum-3.png";
import scutum4 from "@/assets/gear/scutum-4.png";
import parma1 from "@/assets/gear/parma-1.png";
import parma2 from "@/assets/gear/parma-2.png";
import parma3 from "@/assets/gear/parma-3.png";
import parma4 from "@/assets/gear/parma-4.png";
import beastHead1 from "@/assets/gear/beast-head-1.png";
import beastHead2 from "@/assets/gear/beast-head-2.png";
import beastHead3 from "@/assets/gear/beast-head-3.png";
import beastHead4 from "@/assets/gear/beast-head-4.png";
import beastBody1 from "@/assets/gear/beast-body-1.png";
import beastBody2 from "@/assets/gear/beast-body-2.png";
import beastBody3 from "@/assets/gear/beast-body-3.png";
import beastBody4 from "@/assets/gear/beast-body-4.png";
import beastLegs1 from "@/assets/gear/beast-legs-1.png";
import beastLegs2 from "@/assets/gear/beast-legs-2.png";
import beastLegs3 from "@/assets/gear/beast-legs-3.png";
import beastLegs4 from "@/assets/gear/beast-legs-4.png";
import beastSaddle1 from "@/assets/gear/beast-saddle-1.png";
import beastSaddle2 from "@/assets/gear/beast-saddle-2.png";
import beastSaddle3 from "@/assets/gear/beast-saddle-3.png";
import beastSaddle4 from "@/assets/gear/beast-saddle-4.png";

const GEAR_ART: Record<string, [string, string, string, string]> = {
  helmet:  [helmet1, helmet2, helmet3, helmet4],
  cuirass: [cuirass1, cuirass2, cuirass3, cuirass4],
  greaves: [greaves1, greaves2, greaves3, greaves4],
  gladius: [gladius1, gladius2, gladius3, gladius4],
  spear:   [spear1, spear2, spear3, spear4],
  trident: [trident1, trident2, trident3, trident4],
  net:     [net1, net2, net3, net4],
  scutum:  [scutum1, scutum2, scutum3, scutum4],
  parma:   [parma1, parma2, parma3, parma4],
  beast_head:   [beastHead1, beastHead2, beastHead3, beastHead4],
  beast_body:   [beastBody1, beastBody2, beastBody3, beastBody4],
  beast_legs:   [beastLegs1, beastLegs2, beastLegs3, beastLegs4],
  beast_saddle: [beastSaddle1, beastSaddle2, beastSaddle3, beastSaddle4],
};

// Which art family does a slot use? Weapon/off-hand depend on the fighter's class.
function gearCategory(slotKey: SlotKey, weaponType: string, isBeast = false): keyof typeof GEAR_ART | null {
  if (isBeast) {
    if (slotKey === "helmet") return "beast_head";
    if (slotKey === "armor") return "beast_body";
    if (slotKey === "legs") return "beast_legs";
    if (slotKey === "offhand") return "beast_saddle";
    return null;
  }
  if (slotKey === "helmet") return "helmet";
  if (slotKey === "armor") return "cuirass";
  if (slotKey === "legs") return "greaves";
  if (slotKey === "weapon") {
    if (weaponType === "gladius" || weaponType === "dual") return "gladius";
    if (weaponType === "spear") return "spear";
    if (weaponType === "net") return "trident";
    return null;
  }
  if (slotKey === "offhand") {
    if (weaponType === "gladius") return "scutum";
    if (weaponType === "spear") return "parma";
    if (weaponType === "net") return "net";
    if (weaponType === "dual") return "gladius";
    return null;
  }
  return null;
}

function gearImage(slotKey: SlotKey, weaponType: string, tier: number, isBeast = false): string | null {
  const cat = gearCategory(slotKey, weaponType, isBeast);
  if (!cat) return null;
  const grade = Math.min(4, Math.max(1, Math.ceil(tier / 2))); // 1-2→1, 3-4→2, 5-6→3, 7-8→4
  return GEAR_ART[cat][grade - 1] ?? null;
}


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
  { key: "pantry", label: "Pantry", desc: "Stores grain, meat, and amphorae — houses more gladiators and beasts", icon: Wheat },
] as const;

const SKILL_TREE = [
  { key: "gladius", label: "Gladius & Shield" },
  { key: "spear", label: "Spear" },
  { key: "net", label: "Net & Trident" },
  { key: "dual", label: "Dual Blades" },
  { key: "beast_lion", label: "Lion Handling" },
  { key: "beast_tiger", label: "Tiger Handling" },
  { key: "beast_elephant", label: "Elephant Handling" },
  { key: "beast_rhino", label: "Rhino Handling" },
  { key: "defense", label: "Defensive Doctrine" },
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
            <Link to="/profile"><Button variant="outline" size="sm"><ScrollText className="mr-1 h-4 w-4" /> Public Profile</Button></Link>
            <Link to="/info"><Button variant="outline" size="sm"><BookOpen className="mr-1 h-4 w-4" /> Codex</Button></Link>
            <Link to="/leaderboard"><Button variant="outline" size="sm"><Trophy className="mr-1 h-4 w-4" /> Champions</Button></Link>
            <Link to="/arena"><Button size="sm"><Swords className="mr-1 h-4 w-4" /> Arena</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>


      <main className="mx-auto max-w-6xl px-6 py-8">
        <VillageView state={data} recruitCost={recruitCost} recruitPending={recruitMut.isPending} onRecruit={() => recruitMut.mutate()} />
      </main>
    </div>
  );
}

// -----------------------------------------------------------
// VILLAGE — map of interactive buildings replacing the tab menu
// -----------------------------------------------------------
type BuildingKey = "ludus" | "market" | "training" | "scouting" | "medicus" | "armory" | "pantry" | "study" | "temple" | "chronicle";

type Building = {
  key: BuildingKey;
  name: string;
  flavor: string;
  Icon: React.ComponentType<{ className?: string }>;
  image: string;
  span?: string; // grid column span
};

const BUILDINGS: Building[] = [
  { key: "ludus",    name: "Ludus Grounds",    flavor: "Your gladiators drill and rest.",        Icon: Home,       image: bLudus,     span: "md:col-span-2" },
  { key: "market",   name: "Slave Market",     flavor: "Buy fresh blood from the provinces.",    Icon: Users,      image: bMarket },
  { key: "training", name: "Training Yard",    flavor: "Higher stat caps and cheaper drills.",   Icon: Dumbbell,   image: bTraining },
  { key: "scouting", name: "Scouting Network", flavor: "Stronger recruits, rare beasts.",        Icon: Search,     image: bScouting },
  { key: "medicus",  name: "Valetudinarium",   flavor: "Faster healing, shorter injuries.",      Icon: Cross,      image: bMedicus },
  { key: "armory",   name: "The Forge",        flavor: "Unlock higher tiers of gear.",           Icon: Hammer,     image: bArmory },
  { key: "pantry",   name: "Pantry",           flavor: "Feed more mouths — expand your roster.", Icon: Wheat,      image: bPantry },
  { key: "study",    name: "Study of Arms",    flavor: "Master a fighting style.",               Icon: BookOpen,   image: bStudy },
  { key: "temple",   name: "Temple of Memory", flavor: "Honor the fallen in your Hall of Fame.", Icon: Award,      image: bTemple },
  { key: "chronicle",name: "Chronicle Stele",  flavor: "Every match, carved in stone.",          Icon: ScrollText, image: bChronicle },
];

function VillageView({
  state, recruitCost, recruitPending, onRecruit,
}: {
  state: State; recruitCost: number; recruitPending: boolean; onRecruit: () => void;
}) {
  const [open, setOpen] = useState<BuildingKey | null>(null);
  const denarii = state.profile?.denarii ?? 0;
  const scoutingLevel = state.profile?.scouting_level ?? 1;
  const dead = state.gladiators.filter(g => g.status === "dead").length;
  const living = state.gladiators.filter(g => g.status !== "dead");
  const humans = living.filter(g => !g.is_beast).length;
  const beasts = living.filter(g => g.is_beast).length;
  const pantryLvl = (state.profile as unknown as { pantry_level?: number })?.pantry_level ?? 1;
  const cap = pantryCapacity(pantryLvl);

  const badges: Partial<Record<BuildingKey, string>> = {
    ludus: `${living.length}`,
    training: `Lv ${state.profile?.training_level ?? 1}`,
    scouting: `Lv ${state.profile?.scouting_level ?? 1}`,
    medicus:  `Lv ${state.profile?.medicus_level ?? 1}`,
    armory:   `Lv ${state.profile?.armory_level ?? 1}`,
    pantry:   `${humans}/${cap.humans} · ${beasts}/${cap.beasts}`,
    temple:   dead > 0 ? `${dead} fallen` : undefined,
    chronicle: state.matches.length ? `${state.matches.length}` : undefined,
  };

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="laurel font-display text-3xl text-primary">Your Ludus</h1>
        <p className="mt-1 font-serif italic text-muted-foreground">Walk the grounds — visit the forge, the market, the temple.</p>
      </div>

      <div
        className="ornate-border relative overflow-hidden rounded-xl p-4 md:p-6"
        style={{
          backgroundImage: `linear-gradient(to bottom, oklch(0.965 0.018 85 / 0.55) 0%, oklch(0.965 0.018 85 / 0.85) 55%, oklch(0.87 0.028 80 / 0.95) 100%), url(${cityBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        {/* ground shadow strip */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[oklch(0.35_0.04_60_/_0.25)] to-transparent" />

        <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4">
          {BUILDINGS.map((b) => {
            const Icon = b.Icon;
            return (
              <button
                key={b.key}
                onClick={() => setOpen(b.key)}
                className={`group relative flex flex-col items-center overflow-hidden rounded-lg border border-border/70 bg-[oklch(0.99_0.012_85_/_0.72)] p-3 text-center backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-[oklch(0.99_0.012_85_/_0.9)] hover:shadow-[var(--shadow-relief)] ${b.span ?? ""}`}
              >
                <div className="relative flex h-32 w-full items-end justify-center md:h-36">
                  {/* soft ground disc */}
                  <div className="absolute bottom-1 h-4 w-4/5 rounded-[50%] bg-[oklch(0.35_0.04_60_/_0.25)] blur-md" />
                  <img
                    src={b.image}
                    alt={b.name}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="relative z-10 h-full w-auto object-contain drop-shadow-[0_6px_10px_oklch(0.2_0.01_60/0.35)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5 font-display text-sm tracking-wide">
                  <Icon className="h-4 w-4 text-primary" /> {b.name}
                </div>
                <div className="mt-0.5 max-w-[18rem] font-serif text-xs italic text-muted-foreground">{b.flavor}</div>
                {badges[b.key] && (
                  <span className="mt-1.5 inline-flex items-center rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {badges[b.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {open && (
            <BuildingPanel
              buildingKey={open}
              state={state}
              denarii={denarii}
              scoutingLevel={scoutingLevel}
              recruitCost={recruitCost}
              recruitPending={recruitPending}
              onRecruit={onRecruit}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BuildingPanel({
  buildingKey, state, denarii, scoutingLevel, recruitCost, recruitPending, onRecruit,
}: {
  buildingKey: BuildingKey; state: State; denarii: number; scoutingLevel: number;
  recruitCost: number; recruitPending: boolean; onRecruit: () => void;
}) {
  const b = BUILDINGS.find(x => x.key === buildingKey)!;
  const Icon = b.Icon;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-2xl">
          <Icon className="h-6 w-6 text-primary" /> {b.name}
        </DialogTitle>
        <p className="font-serif text-sm italic text-muted-foreground">{b.flavor}</p>
      </DialogHeader>

      <div className="mt-4 space-y-6">
        {buildingKey === "ludus" && (
          <>
            {state.gladiators.filter(g => g.status === "dead").length > 0 && <FallenSection state={state} />}
            {state.gladiators.filter(g => g.status !== "dead").length === 0 ? (
              <div className="inscribed ornate-border rounded-lg p-12 text-center">
                <p className="font-serif text-lg italic text-muted-foreground">Your ludus is empty. Visit the Slave Market.</p>
              </div>
            ) : (
              <GladiatorGrid state={state} />
            )}
          </>
        )}

        {buildingKey === "market" && (
          <Card className="inscribed ornate-border">
            <CardContent className="space-y-4 pt-6">
              <p className="font-serif italic text-muted-foreground">
                Send your scouts to the provinces. Better scouting brings stronger recruits — and, if fortune favors you, a captured lion or tiger.
              </p>
              <div className="text-sm text-muted-foreground">
                Scouting Network — <span className="text-accent">Lv {scoutingLevel}</span> · beast chance ~{Math.round(Math.min(0.02 + scoutingLevel * 0.03, 0.2) * 100)}%
              </div>
              <Button size="lg" onClick={onRecruit} disabled={recruitPending || denarii < recruitCost}>
                Scout recruit · {recruitCost} denarii
              </Button>
            </CardContent>
          </Card>
        )}

        {(buildingKey === "training" || buildingKey === "scouting" || buildingKey === "medicus" || buildingKey === "armory" || buildingKey === "pantry") && (() => {
          const f = FACILITIES.find(x => x.key === buildingKey)!;
          const level = (state.profile as unknown as Record<string, number>)?.[`${f.key}_level`] ?? 1;
          return (
            <FacilityCard
              facility={f.key}
              label={f.label}
              desc={f.desc}
              Icon={f.icon}
              level={level}
              denarii={denarii}
            />
          );
        })()}

        {buildingKey === "pantry" && (
          <Card className="inscribed ornate-border">
            <CardContent className="pt-6">
              <p className="mb-3 font-serif text-sm italic text-muted-foreground">
                Your pantry holds enough grain, oil, and salted meat to feed a growing familia. Every rank adds room for three more gladiators and one more beast.
              </p>
              <PantryTable pantryLevel={(state.profile as unknown as { pantry_level?: number })?.pantry_level ?? 1} />
            </CardContent>
          </Card>
        )}

        {buildingKey === "armory" && (
          <Card className="inscribed ornate-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base"><Hammer className="h-4 w-4 text-primary" /> Forge Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 font-serif text-sm italic text-muted-foreground">
                Gear runs from I to VIII. Each rung of the forge unlocks a higher tier of weapon and armor.
              </p>
              <ArmoryTierTable armoryLevel={state.profile?.armory_level ?? 1} />
            </CardContent>
          </Card>
        )}

        {buildingKey === "study" && (
          <>
            <p className="font-serif italic text-muted-foreground">
              Master fighting styles — each rank grants +8% combat power to gladiators using that weapon. Defensive Doctrine hardens armor for every fighter.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {SKILL_TREE.map((s) => {
                const level = state.skills.find(x => x.weapon_type === s.key)?.level ?? 0;
                return <SkillCard key={s.key} weaponType={s.key} label={s.label} level={level} denarii={denarii} />;
              })}
            </div>
          </>
        )}

        {buildingKey === "temple" && (
          <>
            <FallenSection state={state} />
            <HallOfFame state={state} />
          </>
        )}

        {buildingKey === "chronicle" && (
          <Card className="inscribed ornate-border">
            <CardContent className="pt-6">
              {state.matches.length === 0 ? (
                <p className="font-serif italic text-muted-foreground">No matches yet. Send a gladiator to the sand.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {state.matches.map((m) => {
                    const g = state.gladiators.find(x => x.id === m.gladiator_id);
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
        )}
      </div>
    </>
  );
}

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII"];
function ArmoryTierTable({ armoryLevel }: { armoryLevel: number }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {Array.from({ length: MAX_GEAR_TIER }, (_, i) => i + 1).map((tier) => {
        const req = requiredArmoryLevel(tier);
        const unlocked = armoryLevel >= req;
        return (
          <div
            key={tier}
            className={`rounded border p-2 text-center text-xs ${unlocked ? "border-primary/50 bg-primary/5" : "border-border bg-muted/40 text-muted-foreground"}`}
            title={unlocked ? `Tier ${tier} unlocked` : `Requires forge Lv ${req}`}
          >
            <div className="font-display text-base">{ROMAN[tier - 1]}</div>
            <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px]">
              {unlocked ? <Hammer className="h-3 w-3 text-primary" /> : <Lock className="h-3 w-3" />}
              Lv {req}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PantryTable({ pantryLevel }: { pantryLevel: number }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((lvl) => {
        const cap = pantryCapacity(lvl);
        const unlocked = pantryLevel >= lvl;
        const current = pantryLevel === lvl;
        return (
          <div
            key={lvl}
            className={`rounded border p-2 text-center text-xs ${current ? "border-accent bg-accent/10" : unlocked ? "border-primary/50 bg-primary/5" : "border-border bg-muted/40 text-muted-foreground"}`}
          >
            <div className="font-display text-base">{ROMAN[lvl - 1]}</div>
            <div className="mt-0.5 text-[11px]">{cap.humans} <span className="text-muted-foreground">gld</span></div>
            <div className="text-[11px]">{cap.beasts} <span className="text-muted-foreground">beast</span></div>
          </div>
        );
      })}
    </div>
  );
}




function FacilityCard({
  facility, label, desc, Icon, level, denarii,
}: {
  facility: "training" | "scouting" | "medicus" | "armory" | "pantry";
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
  weaponType: "gladius" | "spear" | "net" | "dual" | "beast_lion" | "beast_tiger" | "beast_elephant" | "beast_rhino" | "defense";
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
  const isDefense = weaponType === "defense";
  const bonusText = isDefense ? `+${level * 5}% armor` : `+${level * 8}% power`;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
      <div>
        <div className="flex items-center gap-2 font-display">
          {isBeast ? <Cat className="h-4 w-4 text-accent" /> : isDefense ? <Shield className="h-4 w-4 text-primary" /> : <Swords className="h-4 w-4 text-primary" />}
          {label}
        </div>
        <div className="mt-0.5 text-xs text-accent">{"★".repeat(level)}{"☆".repeat(5 - level)}  <span className="text-muted-foreground">{bonusText}</span></div>
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
        {state.gladiators.filter(g => g.status !== "dead").map((g) => (
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
          <span>{g.health}/{maxHealth(g.stamina)}{injured ? " · Injured" : ""}</span>
        </div>
        <Progress value={(g.health / maxHealth(g.stamina)) * 100} className="h-1.5" />
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
    return <BeastAvatar weaponType={g.weapon_type} size={size} />;
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



function SaddleIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14 Q 6 8 12 8 Q 18 8 21 14 Q 18 16 12 16 Q 6 16 3 14 Z" fill="currentColor" opacity="0.15" />
      <path d="M3 14 Q 6 8 12 8 Q 18 8 21 14" />
      <path d="M3 14 Q 6 18 12 18 Q 18 18 21 14" />
      <path d="M10 8 L 10 5 M14 8 L 14 5" />
      <path d="M8 14 L 16 14" />
    </svg>
  );
}
// Beast head armor — chamfron plate with brow spike.
function BeastHeadIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 6 Q 12 3 17 6 L 18 12 Q 18 18 12 21 Q 6 18 6 12 Z" fill="currentColor" opacity="0.15" />
      <path d="M7 6 Q 12 3 17 6 L 18 12 Q 18 18 12 21 Q 6 18 6 12 Z" />
      <path d="M12 3 L 12 0.5" />
      <circle cx="9.5" cy="12" r="0.9" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.9" fill="currentColor" />
      <path d="M10 17 L 14 17" />
    </svg>
  );
}
// Beast body armor — barding with straps.
function BeastBardingIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6 L 20 6 L 21 12 Q 21 18 17 20 L 7 20 Q 3 18 3 12 Z" fill="currentColor" opacity="0.15" />
      <path d="M4 6 L 20 6 L 21 12 Q 21 18 17 20 L 7 20 Q 3 18 3 12 Z" />
      <path d="M8 6 L 8 20 M16 6 L 16 20" />
      <path d="M4 10 L 20 10" />
    </svg>
  );
}
// Beast leg armor — greave rings around a hoofed leg.
function BeastLegIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3 L 15 3 L 14 20 L 10 20 Z" fill="currentColor" opacity="0.15" />
      <path d="M9 3 L 15 3 L 14 20 L 10 20 Z" />
      <path d="M9 8 L 15 8 M9 13 L 15 13" />
      <path d="M8 20 L 16 20 L 15 22 L 9 22 Z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

// Detailed species-specific beast portrait: lion mane, tiger stripes, elephant tusks, rhino horn.
function BeastAvatar({ weaponType, size = 96 }: { weaponType: string; size?: number }) {
  const s = size;
  const bg = "radial-gradient(circle at 30% 25%, hsl(35 30% 22%), hsl(20 35% 8%))";
  const wrap = "relative overflow-hidden rounded-full border border-accent/60 shadow-inner";

  if (weaponType === "beast_lion") {
    return (
      <div className={wrap} style={{ width: s, height: s, background: bg }}>
        <svg viewBox="0 0 100 100" width={s} height={s}>
          {/* mane */}
          <g fill="#7a4a1a">
            {Array.from({ length: 18 }).map((_, i) => {
              const a = (i / 18) * Math.PI * 2;
              return <ellipse key={i} cx={50 + Math.cos(a) * 30} cy={52 + Math.sin(a) * 30} rx="10" ry="7" transform={`rotate(${(a * 180) / Math.PI} ${50 + Math.cos(a) * 30} ${52 + Math.sin(a) * 30})`} />;
            })}
          </g>
          <circle cx="50" cy="52" r="26" fill="#c88a3a" />
          {/* muzzle */}
          <ellipse cx="50" cy="64" rx="14" ry="10" fill="#e6b878" />
          <ellipse cx="50" cy="60" rx="3" ry="2.2" fill="#2a1408" />
          <path d="M50 62 L 50 70" stroke="#2a1408" strokeWidth="1.2" />
          <path d="M50 70 Q 44 74 40 72 M50 70 Q 56 74 60 72" stroke="#2a1408" strokeWidth="1.2" fill="none" />
          {/* eyes */}
          <ellipse cx="41" cy="50" rx="3" ry="2.2" fill="#fff" />
          <ellipse cx="59" cy="50" rx="3" ry="2.2" fill="#fff" />
          <circle cx="41" cy="50" r="1.5" fill="#3a2a10" />
          <circle cx="59" cy="50" r="1.5" fill="#3a2a10" />
          {/* ears */}
          <path d="M28 34 Q 30 24 38 30 Z" fill="#7a4a1a" />
          <path d="M72 34 Q 70 24 62 30 Z" fill="#7a4a1a" />
          {/* whiskers */}
          <path d="M36 66 L 24 64 M36 68 L 24 70 M64 66 L 76 64 M64 68 L 76 70" stroke="#f0d8a0" strokeWidth="0.6" />
        </svg>
      </div>
    );
  }
  if (weaponType === "beast_tiger") {
    return (
      <div className={wrap} style={{ width: s, height: s, background: bg }}>
        <svg viewBox="0 0 100 100" width={s} height={s}>
          <circle cx="50" cy="52" r="30" fill="#e08a2a" />
          {/* stripes */}
          <g stroke="#1a0a04" strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M28 40 Q 34 44 30 52" />
            <path d="M72 40 Q 66 44 70 52" />
            <path d="M40 30 L 44 40" />
            <path d="M60 30 L 56 40" />
            <path d="M32 60 Q 38 66 34 74" />
            <path d="M68 60 Q 62 66 66 74" />
            <path d="M46 76 L 44 82" />
            <path d="M54 76 L 56 82" />
          </g>
          {/* muzzle */}
          <ellipse cx="50" cy="64" rx="14" ry="10" fill="#f6dcae" />
          <ellipse cx="50" cy="60" rx="3" ry="2.2" fill="#2a1408" />
          <path d="M50 62 L 50 70" stroke="#2a1408" strokeWidth="1.2" />
          <path d="M50 70 Q 44 74 40 72 M50 70 Q 56 74 60 72" stroke="#2a1408" strokeWidth="1.2" fill="none" />
          {/* fangs */}
          <path d="M46 72 L 47 76 L 48 72 Z M52 72 L 53 76 L 54 72 Z" fill="#fff" />
          {/* eyes */}
          <ellipse cx="41" cy="50" rx="3.2" ry="2.2" fill="#f4d857" />
          <ellipse cx="59" cy="50" rx="3.2" ry="2.2" fill="#f4d857" />
          <path d="M41 50 L 41 52 M59 50 L 59 52" stroke="#1a0a04" strokeWidth="1.6" strokeLinecap="round" />
          {/* ears */}
          <path d="M28 32 Q 30 22 38 28 L 34 34 Z" fill="#e08a2a" stroke="#1a0a04" strokeWidth="1" />
          <path d="M72 32 Q 70 22 62 28 L 66 34 Z" fill="#e08a2a" stroke="#1a0a04" strokeWidth="1" />
        </svg>
      </div>
    );
  }
  if (weaponType === "beast_elephant") {
    return (
      <div className={wrap} style={{ width: s, height: s, background: bg }}>
        <svg viewBox="0 0 100 100" width={s} height={s}>
          {/* ears */}
          <ellipse cx="22" cy="52" rx="14" ry="20" fill="#8a8a92" />
          <ellipse cx="78" cy="52" rx="14" ry="20" fill="#8a8a92" />
          <ellipse cx="22" cy="52" rx="10" ry="16" fill="#a5a5b0" />
          <ellipse cx="78" cy="52" rx="10" ry="16" fill="#a5a5b0" />
          {/* head */}
          <ellipse cx="50" cy="46" rx="24" ry="26" fill="#9a9aa2" />
          {/* forehead ridge */}
          <path d="M34 36 Q 50 30 66 36" stroke="#6a6a72" strokeWidth="1.4" fill="none" />
          {/* eyes */}
          <ellipse cx="40" cy="46" rx="2.4" ry="1.8" fill="#fff" />
          <ellipse cx="60" cy="46" rx="2.4" ry="1.8" fill="#fff" />
          <circle cx="40" cy="46" r="1.2" fill="#1a1108" />
          <circle cx="60" cy="46" r="1.2" fill="#1a1108" />
          {/* trunk */}
          <path d="M44 58 Q 40 74 46 86 Q 52 90 56 84 Q 52 78 54 70 Q 56 62 56 58 Z" fill="#9a9aa2" stroke="#6a6a72" strokeWidth="0.8" />
          <path d="M46 66 L 54 66 M46 72 L 54 72 M48 78 L 54 78" stroke="#6a6a72" strokeWidth="0.6" />
          {/* tusks */}
          <path d="M40 68 Q 34 78 32 90 Q 36 88 40 78 Z" fill="#f0e6c8" stroke="#c8b880" strokeWidth="0.6" />
          <path d="M60 68 Q 66 78 68 90 Q 64 88 60 78 Z" fill="#f0e6c8" stroke="#c8b880" strokeWidth="0.6" />
        </svg>
      </div>
    );
  }
  if (weaponType === "beast_rhino") {
    return (
      <div className={wrap} style={{ width: s, height: s, background: bg }}>
        <svg viewBox="0 0 100 100" width={s} height={s}>
          {/* head */}
          <ellipse cx="50" cy="50" rx="30" ry="24" fill="#7a7a80" />
          {/* armor plates */}
          <path d="M20 50 Q 26 40 34 44" stroke="#4a4a52" strokeWidth="1.2" fill="none" />
          <path d="M80 50 Q 74 40 66 44" stroke="#4a4a52" strokeWidth="1.2" fill="none" />
          <path d="M28 62 Q 40 68 50 66 Q 60 68 72 62" stroke="#4a4a52" strokeWidth="1.2" fill="none" />
          {/* horn (big) */}
          <path d="M46 44 Q 50 18 54 44 Q 52 46 50 46 Q 48 46 46 44 Z" fill="#e6d8b0" stroke="#8a7a4a" strokeWidth="0.8" />
          {/* small horn */}
          <path d="M48 50 Q 50 42 52 50 Z" fill="#e6d8b0" stroke="#8a7a4a" strokeWidth="0.6" />
          {/* nostrils */}
          <ellipse cx="44" cy="66" rx="1.8" ry="1.2" fill="#1a1108" />
          <ellipse cx="56" cy="66" rx="1.8" ry="1.2" fill="#1a1108" />
          <path d="M40 70 Q 50 74 60 70" stroke="#3a3038" strokeWidth="1" fill="none" />
          {/* eyes */}
          <ellipse cx="34" cy="46" rx="2" ry="1.6" fill="#fff" />
          <ellipse cx="66" cy="46" rx="2" ry="1.6" fill="#fff" />
          <circle cx="34" cy="46" r="1" fill="#1a1108" />
          <circle cx="66" cy="46" r="1" fill="#1a1108" />
          {/* ears */}
          <ellipse cx="26" cy="30" rx="4" ry="6" fill="#6a6a70" transform="rotate(-20 26 30)" />
          <ellipse cx="74" cy="30" rx="4" ry="6" fill="#6a6a70" transform="rotate(20 74 30)" />
        </svg>
      </div>
    );
  }
  // fallback
  return (
    <div className={wrap} style={{ width: s, height: s, background: bg }}>
      <Cat className="absolute inset-0 m-auto text-accent" style={{ width: s * 0.55, height: s * 0.55 }} />
    </div>
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
  const armoryLevel = state.profile?.armory_level ?? 1;
  const denarii = state.profile?.denarii ?? 0;
  const cap = statCap(trainingLevel);
  const hpMax = maxHealth(g.stamina);
  const tCost = trainCost(trainingLevel);
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
          {g.is_beast ? (
            <>
              <div className="grid grid-cols-2 items-center justify-items-center gap-3">
                <SlotButton
                  slot={{ key: "helmet", label: "Head Armor", Icon: BeastHeadIcon }}
                  tier={getTier("helmet_tier")}
                  disabled={upgradeMut.isPending}
                  onClick={() => upgradeMut.mutate("helmet")}
                  cost={gearCost("helmet", getTier("helmet_tier"), armoryLevel)}
                  armoryLevel={armoryLevel}
                  denarii={denarii}
                  isBeast
                />
                <SlotButton
                  slot={{ key: "armor", label: "Body Armor", Icon: BeastBardingIcon }}
                  tier={getTier("armor_tier")}
                  disabled={upgradeMut.isPending}
                  onClick={() => upgradeMut.mutate("armor")}
                  cost={gearCost("armor", getTier("armor_tier"), armoryLevel)}
                  armoryLevel={armoryLevel}
                  denarii={denarii}
                  isBeast
                />
                <SlotButton
                  slot={{ key: "legs", label: "Leg Armor", Icon: BeastLegIcon }}
                  tier={getTier("legs_tier")}
                  disabled={upgradeMut.isPending}
                  onClick={() => upgradeMut.mutate("legs")}
                  cost={gearCost("legs", getTier("legs_tier"), armoryLevel)}
                  armoryLevel={armoryLevel}
                  denarii={denarii}
                  isBeast
                />
                <SlotButton
                  slot={{ key: "offhand", label: "Saddle", Icon: SaddleIcon }}
                  tier={getTier("offhand_tier")}
                  disabled={upgradeMut.isPending}
                  onClick={() => upgradeMut.mutate("offhand")}
                  cost={gearCost("offhand", getTier("offhand_tier"), armoryLevel)}
                  armoryLevel={armoryLevel}
                  denarii={denarii}
                  isBeast
                />
              </div>
              <p className="mt-3 text-center font-serif text-xs italic text-muted-foreground">
                Barded for the arena — head, flanks, legs, and saddle.
              </p>
            </>
          ) : (
          <div className="grid grid-cols-3 items-center justify-items-center gap-3">
            {/* row 1 */}
            <div />
            <SlotButton
              slot={SLOTS[0]}
              tier={getTier(SLOTS[0].tierField)}
              disabled={upgradeMut.isPending}
              onClick={() => upgradeMut.mutate("helmet")}
              cost={gearCost("helmet", getTier(SLOTS[0].tierField), armoryLevel)}
                    armoryLevel={armoryLevel}
              denarii={denarii}
              weaponType={g.weapon_type}
            />
            <div />

            {/* row 2: weapon (viewer left = character's right) · off-hand */}
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
                    disabled={upgradeMut.isPending}
                    onClick={() => upgradeMut.mutate("weapon")}
                    cost={gearCost("weapon", getTier(SLOTS[3].tierField), armoryLevel)}
                    armoryLevel={armoryLevel}
                    denarii={denarii}
                    weaponType={g.weapon_type}
                  />
                  <div />
                  {offhandSlot ? (
                    <SlotButton
                      slot={offhandSlot}
                      tier={getTier(SLOTS[4].tierField)}
                      disabled={upgradeMut.isPending}
                      onClick={() => upgradeMut.mutate("offhand")}
                      cost={gearCost("offhand", getTier(SLOTS[4].tierField), armoryLevel)}
                    armoryLevel={armoryLevel}
                      denarii={denarii}
                      weaponType={g.weapon_type}
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
              disabled={upgradeMut.isPending}
              onClick={() => upgradeMut.mutate("armor")}
              cost={gearCost("armor", getTier(SLOTS[1].tierField), armoryLevel)}
                    armoryLevel={armoryLevel}
              denarii={denarii}
              weaponType={g.weapon_type}
            />
            <div />

            {/* row 4 */}
            <div />
            <SlotButton
              slot={SLOTS[2]}
              tier={getTier(SLOTS[2].tierField)}
              disabled={upgradeMut.isPending}
              onClick={() => upgradeMut.mutate("legs")}
              cost={gearCost("legs", getTier(SLOTS[2].tierField), armoryLevel)}
                    armoryLevel={armoryLevel}
              denarii={denarii}
              weaponType={g.weapon_type}
            />
            <div />
          </div>
          )}
        </div>



        {/* Right side: portrait, vitals, stats, actions */}
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-1">
            <FaceAvatar g={g} size={120} />
            <div className="mt-1 flex items-center gap-1.5 rounded-full border border-primary/40 bg-secondary/50 px-3 py-0.5 text-xs">
              <Swords className="h-3 w-3 text-primary" />
              <span className="uppercase tracking-widest text-muted-foreground">Power</span>
              <span className="font-display text-sm text-primary">{gladiatorPower(g, skillLevel)}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> Health</span>
              <span>{g.health}/{hpMax}</span>
            </div>
            <Progress value={(g.health / hpMax) * 100} className="h-2" />
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
              const capped = val >= cap;
              const canAfford = denarii >= tCost;
              return (
                <button
                  key={key}
                  onClick={() => trainMut.mutate(key)}
                  disabled={trainMut.isPending || !!injured || capped || !canAfford}
                  className="rounded border border-border bg-secondary/40 p-2 text-center transition hover:border-primary hover:bg-secondary disabled:opacity-50"
                  title={capped ? `Capped at ${cap} — upgrade Training Yard` : !canAfford ? `Need ${tCost} denarii` : `Train · ${tCost} denarii`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="font-display text-lg">{val}<span className="text-[10px] text-muted-foreground">/{cap}</span></div>
                  <div className={`mt-0.5 flex items-center justify-center gap-0.5 text-[10px] ${canAfford ? "text-accent" : "text-destructive"}`}>
                    <Coins className="h-3 w-3" /> {tCost}
                  </div>
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
            <Button size="sm" variant="outline" onClick={() => healMut.mutate()} disabled={healMut.isPending || (g.health >= hpMax && !injured)}>
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
  slot, tier, disabled, onClick, cost, denarii, armoryLevel, weaponType, isBeast,
}: {
  slot: { key: SlotKey; label: string; Icon: React.ComponentType<SlotIconProps> };
  tier: number; disabled: boolean; onClick: () => void; cost?: number; denarii?: number; armoryLevel?: number;
  weaponType?: string; isBeast?: boolean;
}) {
  const atMax = tier >= MAX_GEAR_TIER;
  const nextTier = tier + 1;
  const reqArmory = requiredArmoryLevel(nextTier);
  const forgeLocked = !atMax && armoryLevel !== undefined && armoryLevel < reqArmory;
  const unaffordable = cost !== undefined && (denarii ?? 0) < cost;
  const { Icon, label } = slot;
  const emptyStars = Math.max(0, MAX_GEAR_TIER - tier);
  const img = isBeast ? gearImage(slot.key, weaponType ?? "", tier, true) : (weaponType ? gearImage(slot.key, weaponType, tier) : null);
  const title = atMax
    ? `${label} — mastercraft (VIII)`
    : forgeLocked
    ? `Requires The Forge Lv ${reqArmory} to craft tier ${nextTier}`
    : unaffordable
    ? `Need ${cost} denarii`
    : cost !== undefined
    ? `Upgrade ${label} to tier ${nextTier} · ${cost} denarii`
    : `Upgrade ${label}`;
  return (
    <button
      onClick={onClick}
      disabled={disabled || atMax || forgeLocked || unaffordable}
      title={title}
      className="group relative flex h-20 w-20 flex-col items-center justify-end overflow-hidden rounded-md border border-border bg-card/60 p-1 text-center transition hover:border-primary disabled:opacity-60"
    >
      {img ? (
        <img
          src={img}
          alt={label}
          loading="lazy"
          className="pointer-events-none absolute inset-0 m-auto h-14 w-14 object-contain opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition group-hover:scale-105"
        />
      ) : (
        <Icon className="pointer-events-none absolute inset-0 m-auto h-6 w-6 text-primary group-hover:text-accent" />
      )}
      {tier === 0 && <div className="relative z-10 rounded bg-background/70 px-1 text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur-sm">{label}</div>}
      <div className="relative z-10 rounded bg-background/70 px-1 text-[9px] leading-none text-accent">
        {"★".repeat(tier)}<span className="text-muted-foreground">{"☆".repeat(emptyStars)}</span>
      </div>
      {forgeLocked ? (
        <div className="relative z-10 mt-0.5 flex items-center gap-0.5 rounded bg-background/70 px-1 text-[9px] text-muted-foreground backdrop-blur-sm">
          <Lock className="h-3 w-3" /> Forge {reqArmory}
        </div>
      ) : cost !== undefined && !atMax ? (
        <div className={`relative z-10 mt-0.5 flex items-center gap-0.5 rounded bg-background/70 px-1 text-[9px] backdrop-blur-sm ${unaffordable ? "text-destructive" : "text-accent"}`}>
          <Coins className="h-3 w-3" /> {cost}
        </div>
      ) : null}
    </button>
  );
}

// -----------------------------------------------------------
// FALLEN — dead gladiators awaiting honor or dismissal
// -----------------------------------------------------------
function FallenSection({ state }: { state: State }) {
  const dead = state.gladiators.filter(g => g.status === "dead");
  const denarii = state.profile?.denarii ?? 0;
  if (dead.length === 0) return null;
  return (
    <Card className="inscribed ornate-border border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg text-destructive">
          <Flame className="h-5 w-5" /> Fallen in the Sand
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-serif text-sm italic text-muted-foreground">
          These gladiators died in the arena. Honor them in your Hall of Fame — or let their name fade.
        </p>
        {dead.map(g => <FallenRow key={g.id} g={g} denarii={denarii} />)}
      </CardContent>
    </Card>
  );
}

function FallenRow({ g, denarii }: { g: Gladiator; denarii: number }) {
  const qc = useQueryClient();
  const honor = useServerFn(honorGladiator);
  const dismiss = useServerFn(dismissGladiator);
  const honorCost = Math.max(10, Math.ceil((g.total_invested ?? 0) * 0.05));
  const honorMut = useMutation({
    mutationFn: () => honor({ data: { gladiatorId: g.id } }),
    onSuccess: (r) => { toast.success(`${g.name} enshrined for ${r.cost}d`); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dismissMut = useMutation({
    mutationFn: () => dismiss({ data: { gladiatorId: g.id } }),
    onSuccess: () => { toast.success(`${g.name} laid in an unmarked grave.`); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-display">
          <Skull className="h-4 w-4 text-destructive" />
          <span className="truncate">{g.name}</span>
          <Badge variant="outline">Lv {g.level}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {g.is_beast ? "Beast" : g.class} · {g.wins}W/{g.losses}L · invested {g.total_invested ?? 0}d
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={honorMut.isPending || denarii < honorCost}
          onClick={() => honorMut.mutate()}
        >
          <Award className="mr-1 h-4 w-4" />
          Honor · {honorCost}d
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={dismissMut.isPending}
          onClick={() => { if (confirm(`Bury ${g.name} without honor?`)) dismissMut.mutate(); }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// HALL OF FAME
// -----------------------------------------------------------
function HallOfFame({ state }: { state: State }) {
  const hall = state.hallOfFame ?? [];
  return (
    <Card className="inscribed ornate-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Award className="h-5 w-5 text-accent" /> Hall of Fame
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hall.length === 0 ? (
          <p className="font-serif italic text-muted-foreground">
            No memorials yet. When a champion falls in a death match, honor them here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {hall.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2 font-display text-base">
                    {h.is_beast && <Cat className="h-4 w-4 text-accent" />}
                    {h.name}
                    <Badge variant="outline">Lv {h.level}</Badge>
                    <Badge variant="secondary">{WEAPON_LABELS[h.weapon_type] ?? h.weapon_type}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.is_beast ? "Beast" : h.class} · {h.wins}W/{h.losses}L · enshrined {new Date(h.created_at).toLocaleDateString()}
                  </div>
                  {h.epitaph && (
                    <p className="mt-1 font-serif text-sm italic text-muted-foreground">"{h.epitaph}"</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {h.total_invested}d invested
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

