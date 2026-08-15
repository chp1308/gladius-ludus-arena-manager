import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLudusState, recruitGladiator, trainGladiator, upgradeEquipment,
  healGladiator, dismissGladiator, honorGladiator,
  upgradeFacility, upgradeSkill, updateLudusDescription, WEAPON_LABELS,
  ARENA_TIERS, statCap, maxHealth, trainCost, gearCost, healCost, healRegenPerHour, pantryCapacity, gladiatorPower,
  keyDropChance, EXTENDED_MAX_LEVEL, extendedFacilityCost, relicsCooldownHours,
  trainBigChance, recruitCost as recruitCostFor, beastChance, medicusSpeedPct, maxCraftableTier, armoryDiscountPct,
  runSocialEvent, socialDelegationSize, socialToneWeights, SOCIAL_COOLDOWN_MINUTES,
} from "@/lib/game.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_GEAR_TIER, requiredArmoryLevel } from "@/lib/game.functions";
import { RELICS } from "@/lib/relics";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppHeader, type HeaderAction } from "@/components/app-header";
import { useConfirm } from "@/lib/confirm";
import { formatMinutes, minutesUntil } from "@/lib/format";
import { toast } from "sonner";
import { Coins, Swords, Sword, Shield, ShieldHalf, Heart, X, Skull, Award, Dumbbell, Search, Cross, Hammer, Cat, HardHat, Footprints, Flame, Home, ScrollText, Users, BookOpen, Lock, Trophy, Wheat, Medal, Landmark, Gem, Zap, Brain, KeyRound } from "lucide-react";
import { STAT_INFO, STAT_SCALING_NOTE } from "@/lib/stat-info";

const STAT_INFO_ICONS = { strength: Dumbbell, agility: Zap, stamina: Heart, technique: Brain } as const;
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
import bSocial from "@/assets/ludus/b-social.png";
import bRelics from "@/assets/ludus/b-relics.png";

// Full 20-tier art, one PNG per tier, bulk-imported from the type-named
// folders under gear-tiers/ (e.g. gear-tiers/helmet/helmet-tier-01.png).
// Folder names don't all match the in-code category keys (boots→greaves,
// sword→gladius, shield→scutum) — see GEAR_TIER_FOLDER_TO_CATEGORY below.
const gearTierFiles = import.meta.glob<string>("../../assets/gear/gear-tiers/*/*.png", { eager: true, import: "default" });
const GEAR_TIER_ART: Record<string, string[]> = {};
for (const [path, url] of Object.entries(gearTierFiles)) {
  const match = path.match(/gear-tiers\/([^/]+)\/[^/]+-tier-(\d+)\.png$/);
  if (!match) continue;
  const [, folder, tierStr] = match;
  (GEAR_TIER_ART[folder] ??= [])[Number(tierStr) - 1] = url;
}
const GEAR_TIER_FOLDER_TO_CATEGORY: Record<string, string> = {
  helmet: "helmet", cuirass: "cuirass", boots: "greaves", sword: "gladius",
  spear: "spear", trident: "trident", net: "net", shield: "scutum",
  parma: "parma", beast_head: "beast_head", beast_body: "beast_body",
  beast_legs: "beast_legs", beast_saddle: "beast_saddle",
};

const GEAR_ART: Record<string, string[]> = {};
for (const [folder, category] of Object.entries(GEAR_TIER_FOLDER_TO_CATEGORY)) {
  if (GEAR_TIER_ART[folder]?.length) GEAR_ART[category] = GEAR_TIER_ART[folder];
}

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

// Every category currently has the full 20-image set, mapping tier to art
// 1:1. If a category ever falls back to a shorter set again, its grades
// spread proportionally across all 20 tiers instead — no code change
// needed here either way.
function gearImage(slotKey: SlotKey, weaponType: string, tier: number, isBeast = false): string | null {
  const cat = gearCategory(slotKey, weaponType, isBeast);
  if (!cat) return null;
  const arts = GEAR_ART[cat];
  if (!arts?.length) return null;
  const grade = Math.min(arts.length, Math.max(1, Math.ceil((tier / MAX_GEAR_TIER) * arts.length)));
  return arts[grade - 1] ?? null;
}


export const Route = createFileRoute("/_authenticated/ludus")({
  component: LudusPage,
});

type State = Awaited<ReturnType<typeof getLudusState>>;
type Gladiator = State["gladiators"][number];

const FACILITIES = [
  { key: "training", label: "Training Yard", desc: "Cheaper drills, bigger stat gains, higher stat cap — up to 100 at level 10", icon: Dumbbell },
  { key: "scouting", label: "Scouting Network", desc: "Better recruits, higher chance of beasts", icon: Search },
  { key: "medicus", label: "Valetudinarium", desc: "Cheaper healing, shorter injuries", icon: Cross },
  { key: "armory", label: "Armory", desc: "Cheaper weapon & armor upgrades", icon: Hammer },
  { key: "pantry", label: "Pantry", desc: "Stores grain, meat, and amphorae — houses more gladiators and beasts", icon: Wheat },
  { key: "social", label: "Cursus Honorum", desc: "Send gladiators to court Rome's high society for coin and renown", icon: Landmark },
  { key: "relics", label: "Temple of Relics", desc: "Alternates between shortening the boss-fight cooldown and improving the odds of the Key to the Underworld", icon: Gem },
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


function isExtendedFacility(facility: "training" | "scouting" | "medicus" | "armory" | "pantry" | "social" | "relics") {
  return facility === "training" || facility === "relics" || facility === "armory";
}
function facilityCost(facility: "training" | "scouting" | "medicus" | "armory" | "pantry" | "social" | "relics", curr: number) {
  return isExtendedFacility(facility) ? extendedFacilityCost(curr) : 500 * (curr + 1);
}
function facilityMaxLevel(facility: "training" | "scouting" | "medicus" | "armory" | "pantry" | "social" | "relics") {
  return isExtendedFacility(facility) ? EXTENDED_MAX_LEVEL : 5;
}
function skillCost(curr: number) { return 200 * (curr + 1); }

// Plain-language summary of what a facility's current level actually does,
// shown under its description so the numbers aren't buried in the Codex.
function facilityBonusText(facility: "training" | "scouting" | "medicus" | "armory" | "pantry" | "social" | "relics", level: number): string {
  switch (facility) {
    case "training": {
      const cap = statCap(level);
      const cost = trainCost(level);
      const big = Math.round(trainBigChance(level) * 100);
      return `Active now: stat cap ${cap} · ${cost} denarii per session · ${big}% chance of +2 instead of +1`;
    }
    case "scouting": {
      const cost = recruitCostFor(level);
      const beast = Math.round(beastChance(level) * 100);
      return `Active now: recruits cost ${cost} denarii · ~${beast}% chance of a beast`;
    }
    case "medicus": {
      const priceCut = Math.round((level - 1) * 12);
      const speedCut = Math.round(medicusSpeedPct(level) * 100);
      return `Active now: healing ${priceCut}% cheaper · ${speedCut}% faster recovery and shorter injuries`;
    }
    case "armory": {
      const cut = Math.round(armoryDiscountPct(level) * 100);
      const tier = maxCraftableTier(level);
      return `Active now: gear upgrades ${cut}% cheaper · can craft up to tier ${ROMAN[tier - 1] ?? tier}`;
    }
    case "pantry": {
      const cap = pantryCapacity(level);
      return `Active now: houses up to ${cap.humans} gladiators and ${cap.beasts} beasts`;
    }
    case "social": {
      const size = socialDelegationSize(level);
      const odds = socialToneWeights(level);
      return `Active now: send up to ${size} gladiator${size === 1 ? "" : "s"} · ${Math.round(odds.positive * 100)}% favorable odds`;
    }
    case "relics": {
      const hours = relicsCooldownHours(level);
      const chance = keyDropChance(level);
      const chanceText = chance > 0 ? `1-in-${Math.round(1 / chance)} chance of a Key to the Underworld per boss kill` : "no Key to the Underworld chance yet";
      return `Active now: boss cooldown ${hours}h · ${chanceText}`;
    }
  }
}

function LudusPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
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
  const onRecruit = async () => {
    const ok = await confirm({
      title: "Scout a recruit?",
      description: `You are about to spend ${recruitCost} denarii to scout a new recruit. Do you wish to proceed?`,
    });
    if (ok) recruitMut.mutate();
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const denarii = data.profile?.denarii ?? 0;
  const scoutingLevel = data.profile?.scouting_level ?? 1;
  const recruitCost = recruitCostFor(scoutingLevel);

  const [open, setOpen] = useState<BuildingKey | null>(null);
  const { onCooldown: socialOnCooldown, minutesLeft: socialMinutesLeft } = socialCooldownStatus(data.socialEvents);

  const headerActions: HeaderAction[] = [
    { key: "profile", label: "Public Profile", icon: <ScrollText className="mr-1 h-4 w-4" />, onClick: () => navigate({ to: "/profile" }) },
    { key: "codex", label: "Codex", icon: <BookOpen className="mr-1 h-4 w-4" />, onClick: () => navigate({ to: "/info" }) },
    { key: "champions", label: "Champions", icon: <Trophy className="mr-1 h-4 w-4" />, onClick: () => navigate({ to: "/leaderboard" }) },
    { key: "achievements", label: "Achievements", icon: <Medal className="mr-1 h-4 w-4" />, onClick: () => navigate({ to: "/achievements" }) },
    {
      key: "cursus", icon: <Landmark className="mr-1 h-4 w-4" />, onClick: () => setOpen("social"),
      label: socialOnCooldown ? `Resting — ${formatMinutes(socialMinutesLeft)}` : "Cursus Honorum",
    },
    { key: "signout", label: "Sign out", onClick: signOut, variant: "ghost" },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader
        maxWidth="max-w-7xl"
        title={data.profile?.ludus_name ?? "Ludus"}
        meta={
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-accent" /> {denarii} denarii</span>
            <span className="flex items-center gap-1"><Award className="h-4 w-4 text-accent" /> {data.profile?.reputation ?? 0} fame</span>
            <span>{data.gladiators.filter(g => g.status !== "dead" && !g.is_beast).length} gladiators</span>
          </div>
        }
        actions={headerActions}
        primaryAction={{ key: "fights", label: "Fights", icon: <Swords className="mr-2 h-5 w-5" />, onClick: () => navigate({ to: "/arena" }) }}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <VillageView
          state={data}
          recruitCost={recruitCost}
          recruitPending={recruitMut.isPending}
          onRecruit={onRecruit}
          open={open}
          setOpen={setOpen}
        />
      </main>
    </div>
  );
}

// -----------------------------------------------------------
// VILLAGE — map of interactive buildings replacing the tab menu
// -----------------------------------------------------------
type BuildingKey = "ludus" | "market" | "training" | "scouting" | "medicus" | "armory" | "pantry" | "study" | "temple" | "chronicle" | "social" | "relics";

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
  { key: "social",   name: "Cursus Honorum",   flavor: "Climb Rome's social ladder.",            Icon: Landmark,   image: bSocial },
  { key: "relics",   name: "Temple of Relics", flavor: "Rare treasures won from mythic beasts.", Icon: Gem,        image: bRelics },
];

function VillageView({
  state, recruitCost, recruitPending, onRecruit, open, setOpen,
}: {
  state: State; recruitCost: number; recruitPending: boolean; onRecruit: () => void;
  open: BuildingKey | null; setOpen: (key: BuildingKey | null) => void;
}) {
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
    relics:   `Lv ${state.profile?.relics_level ?? 1}`,
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
                Scouting Network — <span className="text-accent">Lv {scoutingLevel}</span> · beast chance ~{Math.round(beastChance(scoutingLevel) * 100)}%
              </div>
              <Button size="lg" onClick={onRecruit} disabled={recruitPending || denarii < recruitCost}>
                Scout recruit · {recruitCost} denarii
              </Button>
            </CardContent>
          </Card>
        )}

        {(buildingKey === "training" || buildingKey === "scouting" || buildingKey === "medicus" || buildingKey === "armory" || buildingKey === "pantry" || buildingKey === "social" || buildingKey === "relics") && (() => {
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

        {buildingKey === "training" && <StatTypesPanel />}

        {buildingKey === "social" && <SocialEventPanel state={state} />}

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

        {buildingKey === "relics" && <RelicsPanel state={state} />}

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

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];
function ArmoryTierTable({ armoryLevel }: { armoryLevel: number }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
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

function socialCooldownStatus(socialEvents: State["socialEvents"]): { onCooldown: boolean; minutesLeft: number } {
  const last = socialEvents[0];
  if (!last) return { onCooldown: false, minutesLeft: 0 };
  const nextAt = new Date(last.created_at).getTime() + SOCIAL_COOLDOWN_MINUTES * 60_000;
  const onCooldown = Date.now() < nextAt;
  const minutesLeft = onCooldown ? Math.max(1, Math.ceil((nextAt - Date.now()) / 60_000)) : 0;
  return { onCooldown, minutesLeft };
}

const TONE_STYLES: Record<string, string> = {
  positive: "border-accent/50 bg-accent/5 text-accent",
  negative: "border-destructive/50 bg-destructive/5 text-destructive",
  neutral: "border-border bg-muted/30 text-muted-foreground",
};

function SocialEventPanel({ state }: { state: State }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const run = useServerFn(runSocialEvent);
  const socialLevel = state.profile?.social_level ?? 1;
  const maxSize = socialDelegationSize(socialLevel);
  const odds = socialToneWeights(socialLevel);
  const eligible = state.gladiators.filter(g => g.status !== "dead");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { onCooldown, minutesLeft: cooldownMins } = socialCooldownStatus(state.socialEvents);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= maxSize) return prev;
      return [...prev, id];
    });
  };

  const mut = useMutation({
    mutationFn: () => run({ data: { gladiatorIds: selectedIds } }),
    onSuccess: (r) => {
      if (r.tone === "positive") toast.success(r.log);
      else if (r.tone === "negative") toast.error(r.log);
      else toast(r.log);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["ludus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSend = async () => {
    const ok = await confirm({
      title: "Court Roman society?",
      description: `Send ${selectedIds.length} gladiator${selectedIds.length === 1 ? "" : "s"} to seek favor in Rome? Fortune may reward or punish them — outcomes are ${Math.round(odds.positive * 100)}% likely to be favorable at this level.`,
    });
    if (ok) mut.mutate();
  };

  return (
    <>
      <Card className="inscribed ornate-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Landmark className="h-4 w-4 text-primary" /> Send a Delegation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-serif text-sm italic text-muted-foreground">
            Choose up to {maxSize} gladiator{maxSize === 1 ? "" : "s"} to attend Rome's feasts, weddings, and games.
            Positive outcomes pay out per gladiator sent; ill fortune never scales with the size of your delegation.
          </p>
          {eligible.length === 0 ? (
            <p className="font-serif italic text-muted-foreground">No gladiators available to send.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {eligible.map((g) => {
                const selected = selectedIds.includes(g.id);
                const dim = !selected && selectedIds.length >= maxSize;
                return (
                  <button
                    key={g.id}
                    onClick={() => toggle(g.id)}
                    disabled={mut.isPending}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
                      selected ? "border-primary bg-primary/10" : dim ? "border-border opacity-50" : "border-border hover:border-primary/60"
                    }`}
                  >
                    <span className="font-display">{g.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">Lv {g.level}</span>
                  </button>
                );
              })}
            </div>
          )}
          <Button
            className="w-full"
            size="lg"
            disabled={selectedIds.length === 0 || onCooldown || mut.isPending}
            onClick={onSend}
          >
            {mut.isPending
              ? "The delegation departs..."
              : onCooldown
                ? `Resting — ${formatMinutes(cooldownMins)}`
                : `Send ${selectedIds.length || ""} to Rome`.trim()}
          </Button>
        </CardContent>
      </Card>

      {state.socialEvents.length > 0 && (
        <Card className="inscribed ornate-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Recent Outings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {state.socialEvents.map((e) => (
                <li key={e.id} className={`rounded-lg border p-2.5 text-xs ${TONE_STYLES[e.tone] ?? TONE_STYLES.neutral}`}>
                  <div className="text-foreground">{e.log}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider opacity-70">
                    {e.gladiator_names.join(", ")} · {new Date(e.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}




function FacilityCard({
  facility, label, desc, Icon, level, denarii,
}: {
  facility: "training" | "scouting" | "medicus" | "armory" | "pantry" | "social" | "relics";
  label: string; desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  level: number; denarii: number;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const upgrade = useServerFn(upgradeFacility);
  const mut = useMutation({
    mutationFn: () => upgrade({ data: { facility } }),
    onSuccess: (r) => { toast.success(`${label} → Lv ${r.newLevel}`); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const maxLevel = facilityMaxLevel(facility);
  const atMax = level >= maxLevel;
  const cost = facilityCost(facility, level);
  const onUpgrade = async () => {
    const ok = await confirm({
      title: "Upgrade facility?",
      description: `You are about to spend ${cost} denarii to upgrade ${label} to level ${level + 1}. Do you wish to proceed?`,
    });
    if (ok) mut.mutate();
  };
  return (
    <Card className="inscribed ornate-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Icon className="h-5 w-5 text-primary" /> {label}
          </CardTitle>
          <Badge className="bg-accent text-accent-foreground">Lv {level}/{maxLevel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-serif text-sm italic text-muted-foreground">{desc}</p>
        <p className="text-xs text-accent">{facilityBonusText(facility, level)}</p>
        <Button
          className="w-full"
          size="sm"
          disabled={atMax || mut.isPending || denarii < cost}
          onClick={onUpgrade}
        >
          {atMax ? "Maxed" : `Upgrade · ${cost} denarii`}
        </Button>
      </CardContent>
    </Card>
  );
}

// What each stat trained here actually does — same copy as the Combat
// Codex (/info), shown inline so a player doesn't have to leave the
// Training Yard to know what they're spending denarii on.
function StatTypesPanel() {
  return (
    <Card className="inscribed ornate-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">What Each Stat Does</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {STAT_INFO.map((s) => {
            const Icon = STAT_INFO_ICONS[s.key];
            return (
              <div key={s.key} className="rounded-lg border border-border bg-card/50 p-3">
                <div className="flex items-center gap-2 font-display text-sm">
                  <Icon className="h-4 w-4 text-primary" /> {s.label}
                </div>
                <p className="mt-1 font-serif text-xs italic text-muted-foreground">{s.blurb}</p>
                <div className="mt-2 space-y-1">
                  {s.bonuses.map((b) => (
                    <div key={b.label} className="flex justify-between gap-2 border-t border-border/40 pt-1 text-xs">
                      <span className="text-foreground">{b.label}</span>
                      <span className="text-right text-muted-foreground">{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs italic text-muted-foreground">{STAT_SCALING_NOTE}</p>
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
  const confirm = useConfirm();
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
  const onUpgrade = async () => {
    const ok = await confirm({
      title: "Upgrade skill?",
      description: `You are about to spend ${cost} denarii to upgrade ${label} to rank ${level + 1}. Do you wish to proceed?`,
    });
    if (ok) mut.mutate();
  };
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
        onClick={onUpgrade}>
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
          <span>{g.health}/{maxHealth(g.strength)}{injured ? " · Injured" : ""}</span>
        </div>
        <Progress value={(g.health / maxHealth(g.strength)) * 100} className="h-1.5" />
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

// Realistic portraits: pool of AI-generated headshots grouped by weapon type
// so each class shows fighters wielding the correct armament. Picked
// deterministically by gladiator id so each fighter keeps a stable face.
import pGladius1 from "@/assets/portraits/gladius_1.jpg";
import pGladius2 from "@/assets/portraits/gladius_2.jpg";
import pGladius3 from "@/assets/portraits/gladius_3.jpg";
import pGladius4 from "@/assets/portraits/gladius_4.jpg";
import pGladius5 from "@/assets/portraits/gladius_5.jpg";
import pSpear1 from "@/assets/portraits/spear_1.jpg";
import pSpear2 from "@/assets/portraits/spear_2.jpg";
import pSpear3 from "@/assets/portraits/spear_3.jpg";
import pSpear4 from "@/assets/portraits/spear_4.jpg";
import pSpear5 from "@/assets/portraits/spear_5.jpg";
import pNet1 from "@/assets/portraits/net_1.jpg";
import pNet2 from "@/assets/portraits/net_2.jpg";
import pNet3 from "@/assets/portraits/net_3.jpg";
import pNet4 from "@/assets/portraits/net_4.jpg";
import pNet5 from "@/assets/portraits/net_5.jpg";
import pDual1 from "@/assets/portraits/dual_1.jpg";
import pDual2 from "@/assets/portraits/dual_2.jpg";
import pDual3 from "@/assets/portraits/dual_3.jpg";
import pDual4 from "@/assets/portraits/dual_4.jpg";
import pDual5 from "@/assets/portraits/dual_5.jpg";
import beastLion from "@/assets/portraits/beast_lion.jpg";
import beastTiger from "@/assets/portraits/beast_tiger.jpg";
import beastElephant from "@/assets/portraits/beast_elephant.jpg";
import beastRhino from "@/assets/portraits/beast_rhino.jpg";

const PORTRAITS_BY_WEAPON: Record<string, string[]> = {
  gladius: [pGladius1, pGladius2, pGladius3, pGladius4, pGladius5],
  spear: [pSpear1, pSpear2, pSpear3, pSpear4, pSpear5],
  net: [pNet1, pNet2, pNet3, pNet4, pNet5],
  dual: [pDual1, pDual2, pDual3, pDual4, pDual5],
};
const ALL_HUMAN_PORTRAITS = Object.values(PORTRAITS_BY_WEAPON).flat();
const BEAST_PORTRAITS: Record<string, string> = {
  beast_lion: beastLion,
  beast_tiger: beastTiger,
  beast_elephant: beastElephant,
  beast_rhino: beastRhino,
};

// Minimal shape FaceAvatar actually needs — lets callers render a portrait
// for gladiators they only have partial data for (e.g. a PvP opponent from
// a challenge listing), not just full Gladiator rows.
export type PortraitSubject = { id: string; is_beast: boolean; weapon_type: string };

export function FaceAvatar({ g, size = 96 }: { g: PortraitSubject; size?: number }) {
  const s = size;
  if (g.is_beast) {
    const src = BEAST_PORTRAITS[g.weapon_type];
    return (
      <div
        className="relative overflow-hidden rounded-full border border-accent/60 shadow-[inset_0_0_18px_rgba(0,0,0,0.6)]"
        style={{ width: s, height: s, background: "#100804" }}
      >
        {src ? (
          <img src={src} alt="beast portrait" loading="lazy" width={512} height={512}
            className="h-full w-full object-cover" />
        ) : (
          <Cat className="absolute inset-0 m-auto text-accent" style={{ width: s * 0.55, height: s * 0.55 }} />
        )}
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_24px_rgba(0,0,0,0.55)]" />
      </div>
    );
  }
  const pool = PORTRAITS_BY_WEAPON[g.weapon_type] ?? ALL_HUMAN_PORTRAITS;
  const rng = seedFrom(g.id);
  const idx = Math.floor(rng() * pool.length);
  return (
    <div
      className="relative overflow-hidden rounded-full border border-primary/50 shadow-[inset_0_0_18px_rgba(0,0,0,0.55)]"
      style={{ width: s, height: s, background: "#100804" }}
    >
      <img src={pool[idx]} alt="gladiator portrait" loading="lazy" width={512} height={512}
        className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_22px_rgba(0,0,0,0.5)]" />
    </div>
  );
}

function BeastAvatar({ weaponType, size = 96 }: { weaponType: string; size?: number }) {
  const s = size;
  const src = BEAST_PORTRAITS[weaponType];
  return (
    <div
      className="relative overflow-hidden rounded-full border border-accent/60 shadow-[inset_0_0_18px_rgba(0,0,0,0.6)]"
      style={{ width: s, height: s, background: "#100804" }}
    >
      {src ? (
        <img src={src} alt="beast portrait" loading="lazy" width={512} height={512}
          className="h-full w-full object-cover" />
      ) : (
        <Cat className="absolute inset-0 m-auto text-accent" style={{ width: s * 0.55, height: s * 0.55 }} />
      )}
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_24px_rgba(0,0,0,0.55)]" />
    </div>
  );
}


type SlotKey = "helmet" | "armor" | "legs" | "weapon" | "offhand";
type SlotIconProps = { className?: string };

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
function BeastBardingIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6 L 20 6 L 21 12 Q 21 18 17 20 L 7 20 Q 3 18 3 12 Z" fill="currentColor" opacity="0.15" />
      <path d="M4 6 L 20 6 L 21 12 Q 21 18 17 20 L 7 20 Q 3 18 3 12 Z" />
      <path d="M8 6 L 8 20 M16 6 L 16 20" />
    </svg>
  );
}
function BeastLegIcon({ className }: SlotIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="8" cy="12" r="4" />
      <circle cx="16" cy="12" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="16" cy="12" r="4" />
      <path d="M6 12 L 10 12 M14 12 L 18 12" />
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
  const confirm = useConfirm();
  const train = useServerFn(trainGladiator);
  const upgrade = useServerFn(upgradeEquipment);
  const heal = useServerFn(healGladiator);
  const dismiss = useServerFn(dismissGladiator);

  const injured = g.injury_until && new Date(g.injury_until) > new Date();
  const injuryMinsLeft = injured ? minutesUntil(g.injury_until!) : 0;
  const skillLevel = state.skills.find(s => s.weapon_type === g.weapon_type)?.level ?? 0;
  const trainingLevel = state.profile?.training_level ?? 1;
  const armoryLevel = state.profile?.armory_level ?? 1;
  const denarii = state.profile?.denarii ?? 0;
  const cap = statCap(trainingLevel);
  const hpMax = maxHealth(g.strength);
  const tCost = trainCost(trainingLevel);
  const medicusLevel = state.profile?.medicus_level ?? 1;
  const needsHealing = g.health < hpMax || !!injured;
  const healPrice = healCost(hpMax - g.health, medicusLevel, g.level);
  const missingHealth = hpMax - g.health;
  const regenMinsLeft = missingHealth > 0
    ? Math.ceil((missingHealth / healRegenPerHour(g.agility, medicusLevel, trainingLevel)) * 60)
    : 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ludus"] });

  const [trainTimes, setTrainTimes] = useState(1);
  const trainMut = useMutation({
    mutationFn: (stat: "strength" | "agility" | "stamina" | "technique") =>
      train({ data: { gladiatorId: g.id, stat, times: trainTimes } }),
    onSuccess: (r) => { toast.success(`+${r.gain} ${r.stat} (${r.sessions} session${r.sessions === 1 ? "" : "s"})`); invalidate(); },
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
            <FaceAvatar g={g} size={200} />
            <div className="mt-1 flex items-center gap-1.5 rounded-full border border-primary/40 bg-secondary/50 px-3 py-0.5 text-xs">
              <Swords className="h-3 w-3 text-primary" />
              <span className="uppercase tracking-widest text-muted-foreground">Power</span>
              <span className="font-display text-sm text-primary">{gladiatorPower(g, skillLevel)}</span>
            </div>
            {skillLevel > 0 && (
              <div className="text-[10px] text-muted-foreground">
                includes <span className="text-accent">+{gladiatorPower(g, skillLevel) - gladiatorPower(g, 0)}</span> from Study of Arms (rank {skillLevel})
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> Health</span>
              <span>{g.health}/{hpMax}</span>
            </div>
            <Progress value={(g.health / hpMax) * 100} className="h-2" />
            {regenMinsLeft > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Heals to full naturally in ~{formatMinutes(regenMinsLeft)}</p>
            )}
            {injured && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <Skull className="h-3 w-3" /> Injured — {formatMinutes(injuryMinsLeft)} until recovery
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

          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Sessions per click</span>
            <div className="flex gap-1">
              {[1, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setTrainTimes(n)}
                  className={`rounded border px-2 py-0.5 text-xs transition ${trainTimes === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/60"}`}
                >
                  ×{n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {stats.map(([label, val, key]) => {
              const capped = val >= cap;
              // Every session gains at least 1 point, so at most (cap - val)
              // sessions can ever run regardless of how many were requested —
              // that bounds the worst-case charge the server could make.
              const maxSessions = Math.min(trainTimes, Math.max(0, cap - val));
              const maxCost = tCost * maxSessions;
              const canAfford = denarii >= maxCost;
              const onTrain = async () => {
                const ok = await confirm({
                  title: "Train gladiator?",
                  description: `You are about to spend up to ${maxCost} denarii training ${g.name}'s ${label} (up to ${maxSessions} session${maxSessions === 1 ? "" : "s"}). Do you wish to proceed?`,
                });
                if (ok) trainMut.mutate(key);
              };
              return (
                <button
                  key={key}
                  onClick={onTrain}
                  disabled={trainMut.isPending || !!injured || capped || !canAfford}
                  className="rounded border border-border bg-secondary/40 p-2 text-center transition hover:border-primary hover:bg-secondary disabled:opacity-50"
                  title={capped ? `Capped at ${cap} — upgrade Training Yard` : !canAfford ? `Need up to ${maxCost} denarii` : `Train up to ${maxSessions}× · up to ${maxCost} denarii`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="font-display text-lg">{val}<span className="text-[10px] text-muted-foreground">/{cap}</span></div>
                  <div className={`mt-0.5 flex items-center justify-center gap-0.5 text-[10px] ${canAfford ? "text-accent" : "text-destructive"}`}>
                    <Coins className="h-3 w-3" /> up to {maxCost}
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
                <Swords className="mr-1 h-4 w-4" /> To the Fights
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: "Heal gladiator?",
                  description: `You are about to spend ${healPrice} denarii to heal ${g.name}. Do you wish to proceed?`,
                });
                if (ok) healMut.mutate();
              }}
              disabled={healMut.isPending || !needsHealing}
            >
              <Heart className="mr-1 h-4 w-4" /> {needsHealing ? `Heal · ${healPrice} denarii` : "Heal"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: "Release gladiator?",
                  description: `You are about to release ${g.name} from your ludus. This cannot be undone. Do you wish to proceed?`,
                  destructive: true,
                });
                if (ok) dismissMut.mutate();
              }}
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
  const confirm = useConfirm();
  const atMax = tier >= MAX_GEAR_TIER;
  const nextTier = tier + 1;
  const reqArmory = requiredArmoryLevel(nextTier);
  const forgeLocked = !atMax && armoryLevel !== undefined && armoryLevel < reqArmory;
  const unaffordable = cost !== undefined && (denarii ?? 0) < cost;
  const { Icon, label } = slot;
  const handleClick = async () => {
    if (cost !== undefined) {
      const ok = await confirm({
        title: "Upgrade equipment?",
        description: `You are about to spend ${cost} denarii to upgrade ${label} to tier ${nextTier}. Do you wish to proceed?`,
      });
      if (!ok) return;
    }
    onClick();
  };
  const img = isBeast ? gearImage(slot.key, weaponType ?? "", tier, true) : (weaponType ? gearImage(slot.key, weaponType, tier) : null);
  const title = atMax
    ? `${label} — mastercraft (${ROMAN[MAX_GEAR_TIER - 1] ?? MAX_GEAR_TIER})`
    : forgeLocked
    ? `Requires The Forge Lv ${reqArmory} to craft tier ${nextTier}`
    : unaffordable
    ? `Need ${cost} denarii`
    : cost !== undefined
    ? `Upgrade ${label} to tier ${nextTier} · ${cost} denarii`
    : `Upgrade ${label}`;
  return (
    <button
      onClick={handleClick}
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
        Tier {tier}<span className="text-muted-foreground">/{MAX_GEAR_TIER}</span>
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
  const confirm = useConfirm();
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
          onClick={async () => {
            const ok = await confirm({
              title: "Honor the fallen?",
              description: `You are about to spend ${honorCost} denarii to enshrine ${g.name} in your Hall of Fame. Do you wish to proceed?`,
            });
            if (ok) honorMut.mutate();
          }}
        >
          <Award className="mr-1 h-4 w-4" />
          Honor · {honorCost}d
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={dismissMut.isPending}
          onClick={async () => {
            const ok = await confirm({
              title: "Bury without honor?",
              description: `You are about to bury ${g.name} without honoring them in your Hall of Fame. This cannot be undone. Do you wish to proceed?`,
              destructive: true,
            });
            if (ok) dismissMut.mutate();
          }}
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

function RelicsPanel({ state }: { state: State }) {
  const owned = state.profile?.relics ?? [];
  const bossKills = (state.profile as unknown as { boss_kills?: Record<string, number> })?.boss_kills ?? {};
  const relicTiers = (state.profile as unknown as { relic_tiers?: Record<string, number> })?.relic_tiers ?? {};
  const hadesKeys = state.profile?.hades_keys ?? 0;
  return (
    <Card className="inscribed ornate-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Gem className="h-5 w-5 text-accent" /> Relics
        </CardTitle>
        <p className="font-serif text-sm italic text-muted-foreground">
          Rare treasures won from mythic beasts — permanent, account-wide boons found in boss loot tables.
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-3">
          <KeyRound className="h-5 w-5 shrink-0 text-accent" />
          <div>
            <div className="font-display text-sm">
              <span className="text-accent">{hadesKeys}</span> Key{hadesKeys === 1 ? "" : "s"} to the Underworld
            </div>
            <p className="font-serif text-xs italic text-muted-foreground">
              A consumable dropped by Cerberus. Hold onto these — they'll unlock something more, in time.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {RELICS.map((r) => {
            const has = owned.includes(r.key);
            const kills = r.bonusTier ? (bossKills[r.bonusTier.bossKey] ?? 0) : 0;
            const tierUnlocked = !!r.bonusTier && kills >= r.bonusTier.killsRequired;
            return (
              <li key={r.key} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  {has && r.image ? (
                    <img src={r.image} alt={r.label} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                      <Gem className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <div className={`flex items-center gap-2 font-display text-base ${has ? "text-primary" : "text-muted-foreground"}`}>
                      {has ? r.label : "???"}
                    </div>
                    <p className="mt-1 font-serif text-sm italic text-muted-foreground">
                      {has ? r.description : "An undiscovered relic. Defeat the beast that guards it to find out what it does."}
                    </p>
                    {has && r.bonusTier && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tierUnlocked ? r.bonusTier.label : `${kills}/${r.bonusTier.killsRequired} slain — ${r.bonusTier.killsRequired - kills} more for another +${Math.round(r.bonusTier.extraGoldBonusPct * 100)}%.`}
                      </p>
                    )}
                    {has && r.maxTier && r.tierDescription && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {/* Falls back to 0, matching globalEventMaxFighters'
                            own fallback — this must never promise a tier the
                            server won't actually honor. */}
                        {r.tierDescription(Math.min(r.maxTier, relicTiers[r.key] ?? 0))}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={has ? "default" : "outline"} className="shrink-0">
                  {has ? "Owned" : "Not found"}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

