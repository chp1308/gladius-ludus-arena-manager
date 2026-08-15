import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  getLudusState, fightMatch, fightTeamBattle,
  postPvpChallenge, cancelPvpChallenge, listOpenPvpChallenges, acceptPvpChallenge,
  matchRating, gladiatorPower,
  ARENA_TIERS, tierUnlockReason,
  TEAM_BATTLES, teamBattleRequirementError, TEAM_DENARII_SCALE, WEAPON_LABELS,
  healGladiator, maxHealth, honorGladiator, healCost,
  getPitFightAvailability, PIT_MAX_CHARGES,
  getTeamBattleAvailability, TEAM_MAX_CHARGES,
  getBossFightState, startBossFight, resolveBossRound,
  BOSS_PLAYER_REVEAL_MS, BOSS_BOAR_REVEAL_MS,
  keyDropChance,
  getGlobalEventState, strikeGlobalEvent, GLOBAL_EVENT_STRIKE_COOLDOWN_SEC,
} from "@/lib/game.functions";
import type { FightRound, BossRoundOutcome } from "@/lib/game.functions";
import { BOSS_ENCOUNTERS, bossRequirementError, type BossDefinition, type DogLungeVariant } from "@/lib/boss-encounters";
import { FaceAvatar } from "./ludus";
import type { PortraitSubject } from "./ludus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppHeader, type HeaderAction } from "@/components/app-header";
import { useConfirm } from "@/lib/confirm";
import { formatMinutes, minutesUntil } from "@/lib/format";
import { toast } from "sonner";
import { Coins, Swords, Trophy, Skull, Award, Cat, ArrowLeft, ArrowRight, ArrowDown, Users, Shield, Heart, Flame, Zap, Wind } from "lucide-react";
import porphyrionSelectImg from "@/assets/events/event-select.jpg";
import porphyrionArenaBgImg from "@/assets/events/event-arena-bg.jpg";
import porphyrionAttackImg from "@/assets/events/event-attack.jpg";
import porphyrionDefeatedImg from "@/assets/events/event-defeated.jpg";

function formatCountdown(iso: string): string {
  return formatMinutes(minutesUntil(iso));
}

// Fisher-Yates — used to re-order the block/dodge cards each round so a
// fixed keystroke pattern (e.g. "B-D-D") can't be memorized once and
// replayed blind for the rest of the boar fight.
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function HealButton({ g, medicusLevel }: { g: Gladiator; medicusLevel: number }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const heal = useServerFn(healGladiator);
  const injured = !!(g.injury_until && new Date(g.injury_until) > new Date());
  const needsHeal = g.health < maxHealth(g.strength) || injured;
  const cost = healCost(maxHealth(g.strength) - g.health, medicusLevel, g.level);
  const mut = useMutation({
    mutationFn: () => heal({ data: { gladiatorId: g.id } }),
    onSuccess: (r) => { toast.success(`${g.name} healed for ${r.cost}d`); qc.invalidateQueries({ queryKey: ["ludus"] }); qc.invalidateQueries({ queryKey: ["rivals"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!needsHeal) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-1 h-7 w-full text-xs"
      disabled={mut.isPending}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await confirm({
          title: injured ? "Treat injury?" : "Heal gladiator?",
          description: `You are about to spend ${cost} denarii to ${injured ? "treat" : "heal"} ${g.name}. Do you wish to proceed?`,
        });
        if (ok) mut.mutate();
      }}
    >
      <Heart className="mr-1 h-3 w-3 text-accent" />
      {mut.isPending ? "Tending..." : injured ? "Treat injury" : "Heal"}
    </Button>
  );
}

export const Route = createFileRoute("/_authenticated/arena")({
  component: ArenaPage,
});

type State = Awaited<ReturnType<typeof getLudusState>>;
type Gladiator = State["gladiators"][number];
type BossSessionRow = NonNullable<Awaited<ReturnType<typeof getBossFightState>>["session"]>;

// Same power score shown on the Ludus Grounds gladiator sheet — lets a
// player eyeball a matchup against an arena/battle's posted opponent power
// band before committing a charge.
function skillMapFor(state: State): Map<string, number> {
  return new Map(state.skills.map(s => [s.weapon_type, s.level]));
}
function powerOf(gl: Gladiator, skillMap: Map<string, number>): number {
  return gladiatorPower(gl, skillMap.get(gl.weapon_type) ?? 0);
}

function ArenaPage() {
  const fetchState = useServerFn(getLudusState);
  const { data } = useSuspenseQuery({ queryKey: ["ludus"], queryFn: () => fetchState() });
  const denarii = data.profile?.denarii ?? 0;
  const navigate = useNavigate();

  const fetchEvent = useServerFn(getGlobalEventState);
  const { data: eventData } = useQuery({
    queryKey: ["global-event"],
    queryFn: () => fetchEvent({}),
    refetchInterval: 15_000,
  });
  const hasEvent = !!eventData?.event;

  const headerActions: HeaderAction[] = [
    { key: "codex", label: "Codex", onClick: () => navigate({ to: "/info" }) },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader
        backTo="/ludus"
        title="Fights"
        meta={
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-accent" /> {denarii} denarii</span>
            <span className="flex items-center gap-1"><Award className="h-4 w-4 text-accent" /> {data.profile?.reputation ?? 0} fame</span>
          </div>
        }
        actions={headerActions}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue={hasEvent ? "event" : "pits"} className="w-full">
          <TabsList className={`grid w-full ${hasEvent ? "max-w-3xl grid-cols-5" : "max-w-2xl grid-cols-4"}`}>
            <TabsTrigger value="pits"><Swords className="h-4 w-4 shrink-0 sm:mr-1" /> <span className="hidden sm:inline">Pit Fights</span><span className="sm:hidden">Pits</span></TabsTrigger>
            <TabsTrigger value="pvp"><Shield className="h-4 w-4 shrink-0 sm:mr-1" /> <span className="hidden sm:inline">Rival Ludi</span><span className="sm:hidden">Rivals</span></TabsTrigger>
            <TabsTrigger value="team"><Users className="h-4 w-4 shrink-0 sm:mr-1" /> <span className="hidden sm:inline">Team Battles</span><span className="sm:hidden">Teams</span></TabsTrigger>
            <TabsTrigger value="boss"><Skull className="h-4 w-4 shrink-0 sm:mr-1" /> <span className="hidden sm:inline">Boss Fights</span><span className="sm:hidden">Bosses</span></TabsTrigger>
            {hasEvent && (
              <TabsTrigger value="event"><Flame className="h-4 w-4 shrink-0 sm:mr-1" /> <span className="hidden sm:inline">World Event</span><span className="sm:hidden">Event</span></TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="pits" className="mt-6"><PitFights state={data} /></TabsContent>
          <TabsContent value="pvp" className="mt-6"><PvpFights state={data} /></TabsContent>
          <TabsContent value="team" className="mt-6"><TeamFights state={data} /></TabsContent>
          <TabsContent value="boss" className="mt-6"><BossFights state={data} /></TabsContent>
          {hasEvent && (
            <TabsContent value="event" className="mt-6"><WorldEventFight state={data} /></TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

// -----------------------------------------------------------
// PIT FIGHTS (solo arena tiers)
// -----------------------------------------------------------
function PitFights({ state }: { state: State }) {
  const eligible = state.gladiators.filter(g => g.health >= 30 && (!g.injury_until || new Date(g.injury_until) < new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(eligible[0]?.id ?? null);
  const g = state.gladiators.find(x => x.id === selectedId) ?? null;
  const skillMap = skillMapFor(state);

  const fetchAvailability = useServerFn(getPitFightAvailability);
  const { data: availabilityData } = useQuery({
    queryKey: ["pit-fight-availability"],
    queryFn: () => fetchAvailability({}),
    refetchInterval: 60_000,
  });
  const availability = availabilityData?.availability ?? {};

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Your gladiators</div>
        <div className="space-y-2">
          {state.gladiators.length === 0 && <p className="font-serif italic text-muted-foreground">No gladiators yet.</p>}
          {state.gladiators.filter(gl => gl.status !== "dead").map(gl => {
            const injured = gl.injury_until && new Date(gl.injury_until) > new Date();
            const disabled = injured || gl.health < 30;
            const charges = availability[gl.id];
            return (
              <div key={gl.id}>
                <button
                  disabled={!!disabled}
                  onClick={() => setSelectedId(gl.id)}
                  className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedId === gl.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
                  }`}
                >
                  <div className="flex items-center justify-between font-display">
                    <span className="flex items-center gap-1">{gl.is_beast && <Cat className="h-3 w-3 text-accent" />}{gl.name}</span>
                    <Badge variant="outline">Lv {gl.level}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{gl.wins}W/{gl.losses}L · Power {powerOf(gl, skillMap)} · HP {gl.health}</span>
                    {charges && (
                      <span className={charges.chargesAvailable > 0 ? "text-accent" : "text-destructive"}>
                        {charges.chargesAvailable}/{PIT_MAX_CHARGES} pits
                      </span>
                    )}
                  </div>
                </button>
                <HealButton g={gl} medicusLevel={state.profile?.medicus_level ?? 1} />
              </div>
            );
          })}
        </div>
      </div>

      {g ? (
        <TierPicker key={g.id} g={g} state={state} availability={availability[g.id]} />
      ) : (
        <div className="inscribed ornate-border rounded-lg p-12 text-center font-serif italic text-muted-foreground">
          Select a rested gladiator to send to the pits.
        </div>
      )}
    </div>
  );
}

type PitAvailability = { chargesAvailable: number; nextAvailableAt: string | null; cooldownHours: number };

function TierPicker({ g, state, availability }: { g: Gladiator; state: State; availability?: PitAvailability }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fight = useServerFn(fightMatch);
  const [difficulty, setDifficulty] = useState<string>("backwater");
  const [battle, setBattle] = useState<Awaited<ReturnType<typeof fight>> | null>(null);
  const [animating, setAnimating] = useState(false);

  const mut = useMutation({
    mutationFn: () => fight({ data: { gladiatorId: g.id, difficulty } }),
    onSuccess: (r) => {
      setBattle(r);
      setAnimating(true);
      qc.invalidateQueries({ queryKey: ["ludus"] });
      qc.invalidateQueries({ queryKey: ["pit-fight-availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const onCooldown = !!availability && availability.chargesAvailable <= 0;

  if (battle && animating) {
    return (
      <BattleAnimation
        myLabel={g.name}
        myPortrait={<FaceAvatar g={g} size={96} />}
        oppLabel={battle.opponentName}
        oppPortrait={<GenericFoeAvatar size={96} />}
        myMaxHp={battle.myMaxHp}
        myStartHp={battle.myStartHp}
        oppMaxHp={battle.oppMaxHp}
        rounds={battle.rounds}
        log={battle.log}
        onComplete={() => setAnimating(false)}
      />
    );
  }
  if (battle) return <ResultView result={battle} onClose={() => setBattle(null)} />;

  const selectedTier = ARENA_TIERS.find(t => t.key === difficulty)!;

  return (
    <div className="space-y-4">
      <p className="font-serif italic text-muted-foreground">
        {g.name} — Lv {g.level} · {g.wins}W · Ludus fame {state.profile?.reputation ?? 0}
        {availability && (
          <span className={onCooldown ? "text-destructive" : "text-accent"}>
            {" "}· {availability.chargesAvailable}/{PIT_MAX_CHARGES} pit charges
            {onCooldown && availability.nextAvailableAt && ` (next in ${formatCountdown(availability.nextAvailableAt)})`}
          </span>
        )}
      </p>
      <div className="relative overflow-hidden rounded-lg border border-border">
        <img
          src={selectedTier.imageUrl}
          alt={selectedTier.label}
          loading="lazy"
          className="aspect-video w-full object-cover"
          width={1024}
          height={576}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/60 to-transparent p-4 pt-16">
          <div className="mx-auto max-w-md text-center">
            <div className="font-display text-lg text-primary">{selectedTier.label}</div>
            <div className="font-serif text-xs italic text-muted-foreground">{selectedTier.flavor}</div>
            <div className="mt-1 text-xs text-accent">Opponent power {selectedTier.powerMin}–{selectedTier.powerMax}</div>
            <Button
              className="mt-3"
              size="lg"
              disabled={mut.isPending || onCooldown}
              onClick={async () => {
                const ok = await confirm({
                  title: "Enter the arena?",
                  description: `You are about to send ${g.name} into ${selectedTier.label} against an opponent of power ${selectedTier.powerMin}–${selectedTier.powerMax}. Do you wish to proceed?`,
                });
                if (ok) mut.mutate();
              }}
            >
              {mut.isPending
                ? "The crowd holds its breath..."
                : onCooldown && availability?.nextAvailableAt
                  ? `Resting — ${formatCountdown(availability.nextAvailableAt)}`
                  : "Fight!"}
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {ARENA_TIERS.map(t => {
          const lock = tierUnlockReason(t, state.profile?.reputation ?? 0, g.level, g.wins);
          const selected = difficulty === t.key;
          return (
            <button
              key={t.key}
              disabled={!!lock}
              onClick={() => setDifficulty(t.key)}
              className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-base">{t.label}</div>
                <div className="text-xs text-accent">~{t.reward}d · +{t.rep} fame</div>
              </div>
              <div className="mt-1 font-serif text-xs italic text-muted-foreground">{t.flavor}</div>
              <div className="mt-1 text-xs text-muted-foreground">Foe power {t.powerMin}–{t.powerMax}</div>
              {lock && <div className="mt-1 text-xs text-destructive">🔒 {lock}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Fallen = {
  id: string; name: string; class: string; weapon_type: string; is_beast: boolean;
  level: number; wins: number; losses: number; total_invested: number; honorCost: number;
};

// -----------------------------------------------------------
// PVP — post a challenge, accept a rival's open challenge
// -----------------------------------------------------------
function PvpFights({ state }: { state: State }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PostChallengeCard state={state} />
      <RivalChallengesCard state={state} />
    </div>
  );
}

function PostChallengeCard({ state }: { state: State }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const postFn = useServerFn(postPvpChallenge);
  const cancelFn = useServerFn(cancelPvpChallenge);
  const listFn = useServerFn(listOpenPvpChallenges);
  const eligible = state.gladiators.filter(g =>
    g.status !== "dead" && g.status !== "challenging" &&
    g.health >= 30 && (!g.injury_until || new Date(g.injury_until) < new Date())
  );
  const [selectedId, setSelectedId] = useState<string | null>(eligible[0]?.id ?? null);
  const [toDeath, setToDeath] = useState(false);
  const g = state.gladiators.find(x => x.id === selectedId) ?? null;

  const { data: offers } = useQuery({
    queryKey: ["pvp-offers"],
    queryFn: () => listFn({ data: {} }),
  });

  const post = useMutation({
    mutationFn: () => postFn({ data: { gladiatorId: selectedId!, toDeath } }),
    onSuccess: () => {
      toast.success("Challenge posted to the sands.");
      qc.invalidateQueries({ queryKey: ["ludus"] });
      qc.invalidateQueries({ queryKey: ["pvp-offers"] });
      qc.invalidateQueries({ queryKey: ["pvp-open"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { challengeId: id } }),
    onSuccess: () => {
      toast.success("Challenge withdrawn.");
      qc.invalidateQueries({ queryKey: ["ludus"] });
      qc.invalidateQueries({ queryKey: ["pvp-offers"] });
      qc.invalidateQueries({ queryKey: ["pvp-open"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="bg-card/50">
      <CardHeader>
        <CardTitle className="font-display text-lg">Post a Challenge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-serif text-sm italic text-muted-foreground">
          Stake a champion on the sands. A rival ludus may answer with a fighter of similar standing.
        </p>
        <div className="space-y-2">
          {eligible.length === 0 && <p className="font-serif text-sm italic text-muted-foreground">No rested champions available to post.</p>}
          {eligible.map(gl => {
            const rating = matchRating(gl);
            const woundedPct = gl.health / maxHealth(gl.strength);
            const wounded = woundedPct < 0.85;
            return (
              <button
                key={gl.id}
                onClick={() => setSelectedId(gl.id)}
                className={`w-full rounded-lg border p-2 text-left transition ${selectedId === gl.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
              >
                <div className="flex items-center justify-between font-display text-sm">
                  <span className="flex items-center gap-1">{gl.is_beast && <Cat className="h-3 w-3 text-accent" />}{gl.name}</span>
                  <Badge variant="outline">Lv {gl.level}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {WEAPON_LABELS[gl.weapon_type] ?? gl.weapon_type} · Rating {rating} · HP {gl.health}
                </div>
                {wounded && (
                  <div className="mt-0.5 text-xs text-destructive">
                    ⚠ Wounded — fighting at {Math.round(woundedPct * 100)}% power; rating doesn't reflect this
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className={`flex items-center justify-between rounded-lg border p-3 ${toDeath ? "border-destructive/60 bg-destructive/10" : "border-border bg-card/50"}`}>
          <div className="flex items-center gap-2">
            <Flame className={`h-4 w-4 ${toDeath ? "text-destructive" : "text-muted-foreground"}`} />
            <Label htmlFor="post-death" className="font-display text-sm">Sine missione (5× stakes)</Label>
          </div>
          <Switch id="post-death" checked={toDeath} onCheckedChange={setToDeath} />
        </div>
        <Button
          className="w-full"
          disabled={!g || post.isPending}
          onClick={async () => {
            if (!g) return;
            const ok = await confirm({
              title: "Post a challenge?",
              description: toDeath
                ? `You are about to post ${g.name} for a sine missione (to the death) challenge — 5× stakes, but the loser dies. Do you wish to proceed?`
                : `You are about to post ${g.name} for an open PvP challenge. Do you wish to proceed?`,
              destructive: toDeath,
            });
            if (ok) post.mutate();
          }}
        >
          {post.isPending ? "Heralds ride out..." : "Post Challenge"}
        </Button>

        {offers && offers.myOffers.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Your open offers</div>
            {offers.myOffers.map(o => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2 text-sm">
                <div>
                  <div className="font-display">{o.gladiator?.name ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">
                    Rating {o.rating}{o.to_death && <span className="ml-1 text-destructive">· to the death</span>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(o.id)}>
                  Withdraw
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RivalChallengesCard({ state }: { state: State }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const listFn = useServerFn(listOpenPvpChallenges);
  const acceptFn = useServerFn(acceptPvpChallenge);
  const eligible = state.gladiators.filter(g =>
    g.status !== "dead" && g.status !== "challenging" &&
    g.health >= 30 && (!g.injury_until || new Date(g.injury_until) < new Date())
  );
  const [myId, setMyId] = useState<string | null>(eligible[0]?.id ?? null);
  const [battle, setBattle] = useState<Awaited<ReturnType<typeof acceptFn>> | null>(null);
  const [animating, setAnimating] = useState(false);
  const [opponent, setOpponent] = useState<{ name: string; portrait: PortraitSubject } | null>(null);
  const [opponentFilter, setOpponentFilter] = useState<"all" | "players" | "bots">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["pvp-open", myId],
    queryFn: () => listFn({ data: myId ? { myGladiatorId: myId } : {} }),
  });

  const accept = useMutation({
    mutationFn: (challengeId: string) => acceptFn({ data: { challengeId, myGladiatorId: myId! } }),
    onSuccess: (r) => {
      setBattle(r);
      setAnimating(true);
      qc.invalidateQueries({ queryKey: ["ludus"] });
      qc.invalidateQueries({ queryKey: ["pvp-open"] });
      qc.invalidateQueries({ queryKey: ["pvp-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const myGladiator = state.gladiators.find(x => x.id === myId) ?? null;

  if (battle && animating) {
    return (
      <BattleAnimation
        myLabel={myGladiator?.name ?? "Your champion"}
        myPortrait={myGladiator ? <FaceAvatar g={myGladiator} size={96} /> : <GenericFoeAvatar size={96} />}
        oppLabel={opponent?.name ?? "Rival champion"}
        oppPortrait={opponent ? <FaceAvatar g={opponent.portrait} size={96} /> : <GenericFoeAvatar size={96} />}
        myMaxHp={battle.myMaxHp}
        myStartHp={battle.myStartHp}
        oppMaxHp={battle.oppMaxHp}
        rounds={battle.rounds}
        log={battle.log}
        onComplete={() => setAnimating(false)}
      />
    );
  }
  if (battle) return <PvpResultView result={{ won: battle.won, log: battle.log, fallen: battle.fallen ?? null }} onClose={() => setBattle(null)} />;

  return (
    <Card className="bg-card/50">
      <CardHeader>
        <CardTitle className="font-display text-lg">Rival Challenges</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Answer with</div>
          <div className="flex flex-wrap gap-2">
            {eligible.length === 0 && <p className="font-serif text-sm italic text-muted-foreground">No rested champions.</p>}
            {eligible.map(gl => {
              const woundedPct = gl.health / maxHealth(gl.strength);
              const wounded = woundedPct < 0.85;
              return (
                <button
                  key={gl.id}
                  disabled={accept.isPending}
                  onClick={() => setMyId(gl.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${myId === gl.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
                >
                  <span className="font-display">{gl.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">R{matchRating(gl)}</span>
                  {wounded && (
                    <span className="ml-2 text-xs text-destructive">⚠ {Math.round(woundedPct * 100)}% pwr</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {data && data.openChallenges.length > 0 && (
          <div className="flex items-center gap-1">
            {(["all", "players", "bots"] as const).map(f => (
              <button
                key={f}
                onClick={() => setOpponentFilter(f)}
                className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                  opponentFilter === f ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {isLoading && <p className="font-serif italic text-muted-foreground">Scouts scan the provinces...</p>}
        {data && data.openChallenges.length === 0 && (
          <p className="font-serif italic text-muted-foreground">No rival ludi have open challenges. Return later.</p>
        )}
        {data && data.openChallenges.length > 0 && data.openChallenges.filter(c =>
          opponentFilter === "all" || (opponentFilter === "bots" ? c.is_bot : !c.is_bot)
        ).length === 0 && (
          <p className="font-serif italic text-muted-foreground">No {opponentFilter} challenges open right now.</p>
        )}
        {data && data.openChallenges.filter(c =>
          opponentFilter === "all" || (opponentFilter === "bots" ? c.is_bot : !c.is_bot)
        ).map(c => {
          const g = c.gladiator;
          const disabled = !myId || !c.similar || accept.isPending;
          return (
            <div key={c.id} className={`rounded-lg border p-3 ${c.similar ? "border-border bg-card/40" : "border-border/50 bg-background/30 opacity-70"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 font-display">
                    {g?.is_beast && <Cat className="h-4 w-4 text-accent" />}
                    {g?.name ?? "Unknown"}
                    <Badge variant="outline">Lv {g?.level ?? "?"}</Badge>
                    <Badge variant="secondary">{g ? (WEAPON_LABELS[g.weapon_type] ?? g.weapon_type) : ""}</Badge>
                    <Badge variant="outline" className="text-xs">{c.is_bot ? "Bot" : "Player"}</Badge>
                    {c.to_death && <Badge variant="destructive" className="text-xs">Sine missione</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.ludus_name} · fame {c.ludus_fame} · Rating {c.rating}
                  </div>
                  {!c.similar && myId && (
                    <div className="mt-1 text-xs text-destructive">Not a similar match for your champion.</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={c.to_death ? "destructive" : "default"}
                  disabled={disabled}
                  onClick={async () => {
                    const ok = await confirm({
                      title: c.to_death ? "Fight to the death?" : "Accept challenge?",
                      description: c.to_death
                        ? `You are about to accept a sine missione (to the death) challenge from ${c.ludus_name} — 5× stakes, but the loser dies. Do you wish to proceed?`
                        : `You are about to accept ${c.ludus_name}'s PvP challenge. Do you wish to proceed?`,
                      destructive: c.to_death,
                    });
                    if (!ok) return;
                    setOpponent({
                      name: g?.name ?? "Unknown",
                      portrait: g ? { id: g.id, is_beast: g.is_beast, weapon_type: g.weapon_type } : { id: c.id, is_beast: false, weapon_type: "gladius" },
                    });
                    accept.mutate(c.id);
                  }}
                >
                  {c.to_death ? "Fight to death" : "Accept"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}


function PvpResultView({ result, onClose }: { result: { won: boolean; log: string[]; fallen: Fallen | null }; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const honor = useServerFn(honorGladiator);
  const [honored, setHonored] = useState(false);
  const mut = useMutation({
    mutationFn: (gid: string) => honor({ data: { gladiatorId: gid } }),
    onSuccess: (r) => {
      setHonored(true);
      toast.success(`Memorial raised for ${result.fallen?.name} — ${r.cost}d`);
      qc.invalidateQueries({ queryKey: ["ludus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const fallen = result.fallen;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{result.won ? "Victory!" : "Defeat"}</DialogTitle>
        </DialogHeader>
        <div className={`rounded-lg p-3 text-center ${result.won ? "bg-accent/20" : "bg-muted"}`}>
          {result.won ? <Trophy className="mx-auto h-8 w-8 text-accent" /> : <Skull className="mx-auto h-8 w-8 text-muted-foreground" />}
        </div>
        <ol className="max-h-56 space-y-1 overflow-y-auto font-serif text-sm">
          {result.log.map((line, i) => (
            <li key={i} className="border-l-2 border-border pl-3">{line}</li>
          ))}
        </ol>
        {fallen && !honored && (
          <div className="ornate-border rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <div className="mb-2 flex items-center gap-2 font-display text-lg text-destructive">
              <Skull className="h-5 w-5" /> {fallen.name} has fallen
            </div>
            <p className="mb-3 font-serif text-sm italic text-muted-foreground">
              Honor {fallen.name} in your Hall of Fame — a bronze plaque, a marble bust,
              a tale carved into the walls of your ludus. Costs 5% of the {fallen.total_invested}d
              invested in their glory.
            </p>
            <Button
              className="w-full"
              variant="secondary"
              disabled={mut.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Honor the fallen?",
                  description: `You are about to spend ${fallen.honorCost} denarii to enshrine ${fallen.name} in your Hall of Fame. Do you wish to proceed?`,
                });
                if (ok) mut.mutate(fallen.id);
              }}
            >
              <Award className="mr-2 h-4 w-4" />
              Honor the gladiator — {fallen.honorCost}d
            </Button>
          </div>
        )}
        {fallen && honored && (
          <p className="text-center font-serif italic text-accent">
            {fallen.name} joins the Hall of Fame. May their name outlive us all.
          </p>
        )}
        <Button className="w-full" onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  );
}


// -----------------------------------------------------------
// TEAM BATTLES
// -----------------------------------------------------------
function TeamFights({ state }: { state: State }) {
  const [battleKey, setBattleKey] = useState<string>(TEAM_BATTLES[0].key);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const skillMap = skillMapFor(state);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fightFn = useServerFn(fightTeamBattle);
  const [outcome, setOutcome] = useState<Awaited<ReturnType<typeof fightFn>> | null>(null);
  const [animating, setAnimating] = useState(false);
  const [fightingTeam, setFightingTeam] = useState<Gladiator[]>([]);

  const fetchTeamAvailability = useServerFn(getTeamBattleAvailability);
  const { data: teamAvailabilityData } = useQuery({
    queryKey: ["team-battle-availability"],
    queryFn: () => fetchTeamAvailability({}),
    refetchInterval: 60_000,
  });
  const teamAvailability = teamAvailabilityData?.availability ?? {};

  const battle = TEAM_BATTLES.find(b => b.key === battleKey)!;
  const fame = state.profile?.reputation ?? 0;
  const chosen = state.gladiators.filter(g => selectedIds.includes(g.id));
  const reqErr = selectedIds.length === battle.size
    ? teamBattleRequirementError(battle, chosen, fame)
    : null;

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= battle.size) return prev;
      return [...prev, id];
    });
  };

  const mut = useMutation({
    mutationFn: () => fightFn({ data: { battleKey, gladiatorIds: selectedIds } }),
    onSuccess: (r) => {
      setFightingTeam(chosen);
      setOutcome(r);
      setAnimating(true);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["ludus"] });
      qc.invalidateQueries({ queryKey: ["team-battle-availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (outcome && animating) {
    return (
      <BattleAnimation
        myLabel="Your cohort"
        myPortrait={<PortraitCluster gladiators={fightingTeam} />}
        oppLabel={battle.label}
        oppPortrait={<GenericFoeAvatar size={96} />}
        myMaxHp={outcome.myMaxHp}
        myStartHp={outcome.myStartHp}
        oppMaxHp={outcome.oppMaxHp}
        rounds={outcome.rounds}
        log={outcome.log}
        onComplete={() => setAnimating(false)}
      />
    );
  }
  if (outcome) return <ResultView result={outcome} onClose={() => setOutcome(null)} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Choose a scenario</div>
        <div className="space-y-2">
          {TEAM_BATTLES.map(b => {
            const selected = battleKey === b.key;
            const locked = fame < b.reqFame;
            let requirement = b.requireBeast === b.size ? `${b.size} beasts` : `${b.size} gladiators`;
            if (b.requireClass) requirement += ` · all ${b.requireClass}`;
            if (b.requireBeast && b.requireBeast !== b.size) requirement += ` · ${b.requireBeast} beast${b.requireBeast === 1 ? "" : "s"}`;
            return (
              <button
                key={b.key}
                disabled={locked}
                onClick={() => { setBattleKey(b.key); setSelectedIds([]); }}
                className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-base">{b.label}</div>
                  <div className="text-xs text-accent">~{Math.round(b.reward * TEAM_DENARII_SCALE)}d · +{b.rep} fame</div>
                </div>
                <div className="mt-1 font-serif text-xs italic text-muted-foreground">{b.flavor}</div>
                <div className="mt-1 text-xs text-muted-foreground">Requires: {requirement}</div>
                <div className="mt-1 text-xs text-muted-foreground">Foe power {b.powerMin}–{b.powerMax}</div>
                {locked && <div className="mt-1 text-xs text-destructive">🔒 Ludus needs {b.reqFame} fame</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          Cohort — {selectedIds.length}/{battle.size}
        </div>
        <div className="space-y-2">
          {state.gladiators.filter(gl => gl.status !== "dead").map(gl => {
            const injured = gl.injury_until && new Date(gl.injury_until) > new Date();
            const charges = teamAvailability[gl.id];
            const onCooldown = !!charges && charges.chargesAvailable <= 0;
            const disabled = injured || gl.health < 30 || onCooldown;
            const selected = selectedIds.includes(gl.id);
            const classOk = !battle.requireClass || (!gl.is_beast && gl.class === battle.requireClass);
            const dim = !selected && !classOk;
            return (
              <div key={gl.id}>
                <button
                  disabled={!!disabled || mut.isPending}
                  onClick={() => toggle(gl.id)}
                  className={`w-full rounded-lg border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "border-primary bg-primary/10" : dim ? "border-border opacity-60" : "border-border hover:border-primary/60"
                  }`}
                >
                  <div className="flex items-center justify-between font-display text-sm">
                    <span className="flex items-center gap-1">
                      {gl.is_beast && <Cat className="h-3 w-3 text-accent" />}
                      {gl.name}
                    </span>
                    <Badge variant="outline">Lv {gl.level}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{gl.is_beast ? "Beast" : gl.class} · Power {powerOf(gl, skillMap)} · HP {gl.health}</span>
                    {charges && (
                      <span className={charges.chargesAvailable > 0 ? "text-accent" : "text-destructive"}>
                        {charges.chargesAvailable}/{TEAM_MAX_CHARGES} team
                      </span>
                    )}
                  </div>
                  {onCooldown && charges?.nextAvailableAt && (
                    <div className="mt-0.5 text-xs text-destructive">Resting — next in {formatCountdown(charges.nextAvailableAt)}</div>
                  )}
                </button>
                <HealButton g={gl} medicusLevel={state.profile?.medicus_level ?? 1} />
              </div>
            );
          })}
        </div>
        {reqErr && <p className="mt-3 text-xs text-destructive">{reqErr}</p>}
        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={mut.isPending || selectedIds.length !== battle.size || !!reqErr}
          onClick={async () => {
            const ok = await confirm({
              title: "Begin battle?",
              description: `You are about to send your cohort of ${battle.size} into ${battle.label}. Do you wish to proceed?`,
            });
            if (ok) mut.mutate();
          }}
        >
          {mut.isPending ? "Enter the sand..." : "Begin Battle"}
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// BOSS FIGHTS — a live, multi-round reflex encounter. Unlike the other
// fight types, this isn't fully resolved server-side in one call: each
// round telegraphs a "beat" (vulnerable / defensive / a rare bonus opening),
// the player has a few seconds to strike or hold, and the server scores
// that round immediately before rolling the next one. See
// startBossFight/resolveBossRound in game.functions.ts for the state
// machine this screen is driving.
// -----------------------------------------------------------
type ResolveResult =
  | { done: false; session: BossSessionRow; roundOutcome: BossRoundOutcome }
  | { done: true; won: boolean; log: string[]; denariiGained: number; repGained: number; roundOutcome: BossRoundOutcome };

function BossFights({ state }: { state: State }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const skillMap = skillMapFor(state);
  const fetchBossState = useServerFn(getBossFightState);
  const { data: bossState } = useQuery({
    queryKey: ["boss-fight-state"],
    queryFn: () => fetchBossState({}),
  });
  const startFn = useServerFn(startBossFight);
  const resolveFn = useServerFn(resolveBossRound);

  const [session, setSession] = useState<BossSessionRow | null>(null);
  const [result, setResult] = useState<{ won: boolean; log: string[]; bossKey: string } | null>(null);
  const [bossKey, setBossKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [resumed, setResumed] = useState(false);
  const [reveal, setReveal] = useState<{ prevSession: BossSessionRow; outcome: BossRoundOutcome; next: ResolveResult } | null>(null);
  const [revealStage, setRevealStage] = useState<"player" | "boar" | null>(null);

  // Two-stage pause between a resolved round and the next prompt — see
  // BossRoundReveal. Timed locally rather than off session.round_deadline
  // (which the server already pushed back by the same total, see
  // BOSS_PLAYER_REVEAL_MS/BOSS_BOAR_REVEAL_MS) so it's not at the mercy of
  // clock drift between client and server.
  useEffect(() => {
    if (!reveal) { setRevealStage(null); return; }
    setRevealStage("player");
    const t1 = setTimeout(() => setRevealStage("boar"), BOSS_PLAYER_REVEAL_MS);
    const t2 = setTimeout(() => {
      const r = reveal.next;
      if (r.done) {
        setResult({ won: r.won, log: r.log, bossKey: reveal.prevSession.boss_key });
        setSession(null);
        qc.invalidateQueries({ queryKey: ["ludus"] });
        qc.invalidateQueries({ queryKey: ["boss-fight-state"] });
      } else {
        setSession(r.session);
      }
      setReveal(null);
    }, BOSS_PLAYER_REVEAL_MS + BOSS_BOAR_REVEAL_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reveal, qc]);

  useEffect(() => {
    if (bossState?.session && !session && !resumed) {
      setSession(bossState.session);
      setResumed(true);
    }
  }, [bossState, session, resumed]);

  const boss = bossKey ? BOSS_ENCOUNTERS.find(b => b.key === bossKey) ?? null : null;
  const hasWonLocal = bossState?.hasWonLocal ?? false;
  const defeatedBossKeys = new Set(Object.entries(bossState?.defeated ?? {}).filter(([, v]) => v).map(([k]) => k));
  const chosen = state.gladiators.filter(g => selectedIds.includes(g.id));
  const reqErr = boss && selectedIds.length === boss.size
    ? bossRequirementError(boss, chosen, { hasWonLocalGames: hasWonLocal, defeatedBossKeys })
    : null;
  const cooldownAt = boss ? (bossState?.cooldowns?.[boss.key] ?? null) : null;

  const toggle = (id: string) => {
    if (!boss) return;
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= boss.size) return prev;
      return [...prev, id];
    });
  };

  const beginEncounter = async () => {
    if (!boss) return;
    const ok = await confirm({
      title: "Begin the encounter?",
      description: `You are about to send ${boss.size} gladiators against ${boss.name}. This party is committed for the whole encounter and it plays out live — stay on this screen until it resolves. Do you wish to proceed?`,
    });
    if (ok) startMut.mutate();
  };

  const startMut = useMutation({
    mutationFn: () => startFn({ data: { bossKey: boss!.key, gladiatorIds: selectedIds } }),
    onSuccess: (r) => {
      setSession(r.session);
      setSelectedIds([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMut = useMutation({
    mutationFn: (payload: { action?: "strike" | "hold"; defenses?: Record<string, "block" | "dodge"> }) => resolveFn({ data: payload }),
    onSuccess: (r) => {
      if (!session) return;
      setReveal({ prevSession: session, outcome: r.roundOutcome, next: r as ResolveResult });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result) {
    const resultBoss = BOSS_ENCOUNTERS.find(b => b.key === result.bossKey);
    const resultImage = resultBoss ? (result.won ? resultBoss.defeatedImage : resultBoss.lossImage) : undefined;
    return <ResultView result={result} image={resultImage} onClose={() => { setResult(null); qc.invalidateQueries({ queryKey: ["boss-fight-state"] }); }} />;
  }

  if (reveal) {
    const revealBoss = BOSS_ENCOUNTERS.find(b => b.key === reveal.prevSession.boss_key)!;
    const revealParty = state.gladiators.filter(g => reveal.prevSession.gladiator_ids.includes(g.id));
    return (
      <BossRoundReveal
        boss={revealBoss}
        party={revealParty}
        prevSession={reveal.prevSession}
        nextSession={reveal.next.done ? null : reveal.next.session}
        outcome={reveal.outcome}
        stage={revealStage ?? "player"}
      />
    );
  }

  if (session) {
    const party = state.gladiators.filter(g => session.gladiator_ids.includes(g.id));
    const sessionBoss = BOSS_ENCOUNTERS.find(b => b.key === session.boss_key)!;
    return (
      <BossFightScreen
        session={session}
        boss={sessionBoss}
        party={party}
        pending={resolveMut.isPending}
        onAction={(payload) => resolveMut.mutate(payload)}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Choose an encounter</div>
        <div className="space-y-2">
          {BOSS_ENCOUNTERS.map(b => {
            const selected = bossKey === b.key;
            const locked = b.unlock.type === "local_games" ? !hasWonLocal : !defeatedBossKeys.has(b.unlock.bossKey);
            const lockReason = b.unlock.type === "local_games" ? "Win a fight in Local Games first" : b.unlock.label;
            const cd = bossState?.cooldowns?.[b.key] ?? null;
            const defeated = bossState?.defeated?.[b.key] ?? false;
            const lootCounts = bossState?.lootCounts?.[b.key] ?? {};
            return (
              <div
                key={b.key}
                className={`rounded-lg border transition ${selected ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <button
                  disabled={locked}
                  onClick={() => { setBossKey(prev => prev === b.key ? null : b.key); setSelectedIds([]); }}
                  className="flex w-full items-start gap-3 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary/5"
                >
                  <img src={b.image} alt={b.name} className="h-16 w-16 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-display text-base">{b.name}</div>
                      <div className="text-xs text-accent">{defeated ? "Loot table revealed" : "??? reward"}</div>
                    </div>
                    <div className="mt-1 font-serif text-xs italic text-muted-foreground">{b.flavor}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Requires: {b.size} gladiators</div>
                    {locked && <div className="mt-1 text-xs text-destructive">🔒 {lockReason}</div>}
                    {cd && <div className="mt-1 text-xs text-destructive">Recovering — next in {formatCountdown(cd)}</div>}
                  </div>
                </button>
                {selected && (
                  <div className="border-t border-border p-4">
                    <img src={b.image} alt={b.name} className="mb-3 h-64 w-full rounded-md object-cover" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Myth</div>
                        <p className="font-serif text-sm italic text-muted-foreground">{b.myth}</p>
                        <div className="mb-1 mt-3 text-xs uppercase tracking-widest text-muted-foreground">Bestiary</div>
                        {defeated ? (
                          <ul className="space-y-1 text-sm">
                            {b.phases.map(p => (
                              <li key={p.name}><span className="font-display">{p.name}</span> — <span className="text-muted-foreground">{p.blurb}</span></li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">??? — defeat {b.name} once to reveal its true nature.</p>
                        )}
                      </div>
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Loot Table</div>
                        {defeated ? (
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="py-1 font-normal">Item</th>
                                <th className="py-1 font-normal">Odds</th>
                                <th className="py-1 text-right font-normal">Found</th>
                              </tr>
                            </thead>
                            <tbody>
                              {b.lootTable.map(item => {
                                const count = lootCounts[item.key] ?? 0;
                                const found = count > 0;
                                const itemLabel = item.effect === "denarii" ? `${item.label} (${item.min}–${item.max})` : item.label;
                                const odds = item.effect === "key"
                                  ? Math.round(keyDropChance(state.profile?.relics_level ?? 1) * 100)
                                  : Math.round(item.chance * 100);
                                return (
                                  <tr key={item.key} className={`border-b border-border/60 ${found ? "text-green-600 dark:text-green-400" : ""}`}>
                                    <td className={`py-1.5 ${found ? "font-semibold" : ""}`}>{itemLabel}</td>
                                    <td className="py-1.5">{odds}%</td>
                                    <td className={`py-1.5 text-right font-display ${found ? "font-semibold" : "text-muted-foreground"}`}>
                                      {item.effect === "trinket" ? (found ? "✓ Owned" : "—") : (found ? `×${count}` : "—")}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-sm text-muted-foreground">??? — defeat {b.name} once to reveal its loot table.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        {boss ? (
          <>
            <Button
              className="mb-4 w-full"
              size="lg"
              disabled={!!cooldownAt || startMut.isPending || selectedIds.length !== boss.size || !!reqErr}
              onClick={beginEncounter}
            >
              {startMut.isPending ? "Entering the wilds..." : "Begin Encounter"}
            </Button>
            <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Party — {selectedIds.length}/{boss.size}
            </div>
            {cooldownAt && (
              <p className="mb-2 text-xs text-destructive">
                Recovering — next in {formatCountdown(cooldownAt)}. Browse the encounter, but you can't set a roster until it's ready.
              </p>
            )}
            <div className="space-y-2">
              {state.gladiators.filter(gl => gl.status !== "dead").map(gl => {
                const injured = gl.injury_until && new Date(gl.injury_until) > new Date();
                const disabled = injured || gl.health < 30 || !!cooldownAt;
                const selected = selectedIds.includes(gl.id);
                return (
                  <div key={gl.id}>
                    <button
                      disabled={!!disabled || startMut.isPending}
                      onClick={() => toggle(gl.id)}
                      className={`w-full rounded-lg border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
                      }`}
                    >
                      <div className="flex items-center justify-between font-display text-sm">
                        <span className="flex items-center gap-1">
                          {gl.is_beast && <Cat className="h-3 w-3 text-accent" />}
                          {gl.name}
                        </span>
                        <Badge variant="outline">Lv {gl.level}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {gl.is_beast ? "Beast" : gl.class} · {WEAPON_LABELS[gl.weapon_type] ?? gl.weapon_type} · Power {powerOf(gl, skillMap)} · HP {gl.health}
                      </div>
                    </button>
                    <HealButton g={gl} medicusLevel={state.profile?.medicus_level ?? 1} />
                  </div>
                );
              })}
            </div>
            {reqErr && <p className="mt-3 text-xs text-destructive">{reqErr}</p>}
            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={!!cooldownAt || startMut.isPending || selectedIds.length !== boss.size || !!reqErr}
              onClick={beginEncounter}
            >
              {startMut.isPending ? "Entering the wilds..." : "Begin Encounter"}
            </Button>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Choose an encounter to assemble your party.
          </div>
        )}
      </div>
    </div>
  );
}

type BossAction = { action?: "strike" | "hold"; defenses?: Record<string, "block" | "dodge">; zone?: "left" | "center" | "right" };

// One live round: a countdown against the server-issued deadline, a
// telegraph banner for the current beat, and the choice — Strike/Hold on an
// offensive beat, a per-gladiator Block/Dodge call on a defensive one (the
// boar's charge/howl, or Cerberus's snake bite), or — Cerberus only — a
// single whole-cohort Left/Center/Right call on a head-lunge beat. If the
// deadline lapses without a full response this auto-submits whatever's
// chosen so far — matching the server, which treats any missing answer as
// the worst case, so the two can never disagree about what happened.
function BossFightScreen({
  session, boss, party, pending, onAction,
}: {
  session: BossSessionRow; boss: BossDefinition; party: Gladiator[];
  pending: boolean; onAction: (payload: BossAction) => void;
}) {
  const [msLeft, setMsLeft] = useState(() => new Date(session.round_deadline).getTime() - Date.now());
  const [defenses, setDefenses] = useState<Record<string, "block" | "dodge">>({});
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    autoSubmittedRef.current = false;
    setDefenses({});
    const tick = () => setMsLeft(Math.max(0, new Date(session.round_deadline).getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [session.round, session.phase, session.round_deadline]);

  const beat = session.beat_type;
  const isDefenseBeat = beat === "defensive" || beat === "howl" || beat === "snake_bite";
  const isLungeBeat = beat.startsWith("lunge:");
  const lungeVariant = isLungeBeat ? (beat.slice("lunge:".length) as DogLungeVariant) : null;
  const allChosen = isDefenseBeat && party.every(g => defenses[g.id]);
  const expired = msLeft <= 0;

  // Re-shuffled fresh every round so the card order (and therefore which
  // gladiator each B/D keypress lands on) can't be memorized as a fixed
  // pattern — a player has to actually read each card's weapon every time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defenseOrder = useMemo(() => shuffled(party), [session.round]);

  useEffect(() => {
    if (pending || autoSubmittedRef.current) return;
    if (msLeft <= 0) {
      autoSubmittedRef.current = true;
      onAction(isDefenseBeat ? { defenses } : {});
    } else if (isDefenseBeat && allChosen) {
      autoSubmittedRef.current = true;
      onAction({ defenses });
    }
  }, [msLeft, pending, onAction, isDefenseBeat, allChosen, defenses]);

  // B/D hotkeys during a defensive/howl/snake-bite beat — each press calls
  // block/dodge for the next gladiator in the party who doesn't have a
  // choice locked in yet, so a player can clear the whole line from the
  // keyboard under the timer.
  useEffect(() => {
    if (!isDefenseBeat || pending) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key !== "b" && key !== "d") return;
      const choice = key === "b" ? "block" : "dodge";
      setDefenses(prev => {
        const next = defenseOrder.find(g => !prev[g.id]);
        if (!next) return prev;
        return { ...prev, [next.id]: choice };
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDefenseBeat, pending, defenseOrder]);

  // S/H hotkeys for the offensive beat's Strike/Hold call.
  useEffect(() => {
    if (isDefenseBeat || isLungeBeat || pending || expired) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key !== "s" && key !== "h") return;
      onAction({ action: key === "s" ? "strike" : "hold" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDefenseBeat, isLungeBeat, pending, expired, onAction]);

  // ←/↓/→ hotkeys for Cerberus's head-lunge beat — a single whole-cohort
  // call, not per-gladiator, so any press submits immediately.
  useEffect(() => {
    if (!isLungeBeat || pending || expired) return;
    const handler = (e: KeyboardEvent) => {
      const zone = e.key === "ArrowLeft" ? "left" : e.key === "ArrowDown" ? "center" : e.key === "ArrowRight" ? "right" : null;
      if (!zone) return;
      // Arrow keys scroll the page by default — stop that before it fights
      // the fixed-position fight screen.
      e.preventDefault();
      onAction({ zone });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLungeBeat, pending, expired, onAction]);

  const log = Array.isArray(session.log) ? (session.log as string[]) : [];
  const lastLine = log[log.length - 1];
  const beatLabel = beat === "net_bonus" ? "AN OPENING — Net it!"
    : beat === "vulnerable" ? "VULNERABLE — Strike!"
      : beat === "howl" ? "HOWL — Brace, block or dodge!"
        : beat === "snake_bite" ? "SNAKE BITE — Block or dodge!"
          : lungeVariant === "all_three" ? "ALL THREE HEADS LUNGE — Brace!"
            : lungeVariant === "middle_only" ? "MIDDLE HEAD LUNGES — Move clear!"
              : isLungeBeat ? "HEADS LUNGE — Move clear!"
                : "CHARGING — Block or dodge!";
  const isHarsherBeat = beat === "howl" || beat === "snake_bite" || lungeVariant === "all_three";
  const beatColor = beat === "net_bonus"
    ? "border-sky-500/60 text-sky-400"
    : beat === "vulnerable"
      ? "border-amber-500/60 text-amber-400"
      : isHarsherBeat
        ? "border-red-600/70 text-red-500"
        : "border-destructive/60 text-destructive";
  const secondsLeft = Math.ceil(msLeft / 1000);

  return (
    <div
      className="space-y-6 rounded-xl p-4 md:p-6"
      style={{
        backgroundImage: `linear-gradient(to bottom, oklch(0.15 0.02 40 / 0.72) 0%, oklch(0.12 0.02 40 / 0.85) 100%), url(${boss.arenaBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="text-center">
        <div className="font-display text-lg text-primary">{boss.name} — Phase {session.phase}/{boss.phases.length}</div>
        {lastLine && <p className="mt-1 font-serif text-sm italic text-muted-foreground">{lastLine}</p>}
      </div>

      <div className="flex items-center justify-center gap-10">
        <FighterPanel label="Your Cohort" portrait={<PortraitCluster gladiators={party} size={64} />} hp={session.party_hp} maxHp={session.party_max_hp} hit={false} />
        <FighterPanel label={boss.name} portrait={<BossPortrait boss={boss} beat={beat} />} hp={session.boss_hp} maxHp={session.boss_max_hp} hit={false} />
      </div>

      <div className={`mx-auto max-w-sm rounded-lg border-2 p-4 text-center ${beatColor}`}>
        <div className="font-display text-xl tracking-wide">{beatLabel}</div>
        <div className="mt-1 font-display text-3xl tabular-nums">{expired ? "..." : `${secondsLeft}s`}</div>
      </div>

      {isDefenseBeat ? (
        <div className="mx-auto grid max-w-xl gap-2 sm:grid-cols-3">
          {defenseOrder.map(g => {
            const picked = defenses[g.id];
            return (
              <div key={g.id} className="rounded-lg border border-border p-2 text-center">
                <div className="truncate font-display text-sm">{g.name}</div>
                <div className="mb-2 text-xs text-muted-foreground">{g.is_beast ? "Beast" : (WEAPON_LABELS[g.weapon_type] ?? g.weapon_type)}</div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={picked === "block" ? "default" : "outline"}
                    className="relative min-w-0 flex-1 gap-1 overflow-visible px-1.5"
                    disabled={pending || expired}
                    onClick={() => setDefenses(prev => ({ ...prev, [g.id]: "block" }))}
                  >
                    <Shield className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">Block</span>
                    <kbd className="absolute -right-1 -top-1.5 rounded border border-border bg-background px-1 text-[9px] leading-tight text-foreground opacity-90">B</kbd>
                  </Button>
                  <Button
                    size="sm"
                    variant={picked === "dodge" ? "default" : "outline"}
                    className="relative min-w-0 flex-1 gap-1 overflow-visible px-1.5"
                    disabled={pending || expired}
                    onClick={() => setDefenses(prev => ({ ...prev, [g.id]: "dodge" }))}
                  >
                    <Wind className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">Dodge</span>
                    <kbd className="absolute -right-1 -top-1.5 rounded border border-border bg-background px-1 text-[9px] leading-tight text-foreground opacity-90">D</kbd>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : isLungeBeat ? (
        <div className="mx-auto flex max-w-sm justify-center gap-3">
          <Button size="lg" variant="outline" className="relative flex-1 overflow-visible" disabled={pending || expired} onClick={() => onAction({ zone: "left" })}>
            <ArrowLeft className="mr-2 h-5 w-5" /> Left
            <kbd className="absolute -right-1.5 -top-1.5 rounded border border-border bg-background px-1 text-[10px] leading-tight text-foreground opacity-90">←</kbd>
          </Button>
          <Button size="lg" variant="outline" className="relative flex-1 overflow-visible" disabled={pending || expired} onClick={() => onAction({ zone: "center" })}>
            <ArrowDown className="mr-2 h-5 w-5" /> Center
            <kbd className="absolute -right-1.5 -top-1.5 rounded border border-border bg-background px-1 text-[10px] leading-tight text-foreground opacity-90">↓</kbd>
          </Button>
          <Button size="lg" variant="outline" className="relative flex-1 overflow-visible" disabled={pending || expired} onClick={() => onAction({ zone: "right" })}>
            <ArrowRight className="mr-2 h-5 w-5" /> Right
            <kbd className="absolute -right-1.5 -top-1.5 rounded border border-border bg-background px-1 text-[10px] leading-tight text-foreground opacity-90">→</kbd>
          </Button>
        </div>
      ) : (
        <div className="flex justify-center gap-3">
          <Button size="lg" className="relative overflow-visible" disabled={pending || expired} onClick={() => onAction({ action: "strike" })}>
            <Zap className="mr-2 h-5 w-5" /> Strike
            <kbd className="absolute -right-1.5 -top-1.5 rounded border border-border bg-background px-1 text-[10px] leading-tight text-foreground opacity-90">S</kbd>
          </Button>
          <Button size="lg" variant="outline" className="relative overflow-visible" disabled={pending || expired} onClick={() => onAction({ action: "hold" })}>
            <Shield className="mr-2 h-5 w-5" /> Hold
            <kbd className="absolute -right-1.5 -top-1.5 rounded border border-border bg-background px-1 text-[10px] leading-tight text-foreground opacity-90">H</kbd>
          </Button>
        </div>
      )}
    </div>
  );
}

// Two-stage pause between a resolved round and the next beat's prompt: the
// player's own roll first (black on red), then the boar's passive mauling
// (red on black) — gives each round some weight instead of an instant
// state flip, and visibly tells player-caused damage apart from the boar's.
// HP bars show the round's starting values during the player stage, then
// settle to the fully-resolved values once the boar stage begins (skipped
// on the fight's final round, where the screen cuts to the result dialog
// right after).
function BossRoundReveal({
  boss, party, prevSession, nextSession, outcome, stage,
}: {
  boss: BossDefinition; party: Gladiator[]; prevSession: BossSessionRow; nextSession: BossSessionRow | null;
  outcome: BossRoundOutcome; stage: "player" | "boar";
}) {
  const showFinal = stage === "boar" && nextSession;
  const bossHp = showFinal ? nextSession!.boss_hp : prevSession.boss_hp;
  const partyHp = showFinal ? nextSession!.party_hp : prevSession.party_hp;

  return (
    <div
      className="space-y-6 rounded-xl p-4 md:p-6"
      style={{
        backgroundImage: `linear-gradient(to bottom, oklch(0.15 0.02 40 / 0.72) 0%, oklch(0.12 0.02 40 / 0.85) 100%), url(${boss.arenaBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="text-center">
        <div className="font-display text-lg text-primary">{boss.name} — Phase {prevSession.phase}/{boss.phases.length}</div>
      </div>

      <div className="flex items-center justify-center gap-10">
        <FighterPanel
          label="Your Cohort" portrait={<PortraitCluster gladiators={party} size={64} />}
          hp={partyHp} maxHp={prevSession.party_max_hp}
          hit={stage === "player" && outcome.playerTarget === "party" && outcome.playerDamage > 0}
        />
        <FighterPanel
          label={boss.name} portrait={<BossPortrait boss={boss} beat={prevSession.beat_type} />}
          hp={bossHp} maxHp={prevSession.boss_max_hp}
          hit={stage === "player" && outcome.playerTarget === "boss" && outcome.playerDamage > 0}
        />
      </div>

      {stage === "player" ? (
        <div className="mx-auto max-w-sm rounded-lg border-2 border-red-700 bg-red-600 p-6 text-center shadow-lg">
          <div className="font-display text-lg tracking-wide text-black/80">{outcome.playerLabel}</div>
          <div className="mt-1 font-display text-4xl font-black tabular-nums text-black">
            {outcome.playerDamage > 0 ? `-${outcome.playerDamage}` : "—"}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-sm rounded-lg border-2 border-red-900 bg-black p-6 text-center shadow-lg">
          <div className="font-display text-lg tracking-wide text-red-500/80">The onslaught continues</div>
          <div className="mt-1 font-display text-4xl font-black tabular-nums text-red-500">
            {outcome.tickDamage > 0 ? `-${outcome.tickDamage}` : "—"}
          </div>
        </div>
      )}
    </div>
  );
}

// Charge art for the "CHARGING" regular attack, howl art for the special
// howl attack and for strike windows (vulnerable openings and the rare
// net-bonus) — there's no dedicated "exposed" pose yet, see boss-encounters.ts.
// Cerberus picks its pose from the specific head-lunge variant or the snake
// bite instead, falling back to its select pose for strike windows.
function BossPortrait({ boss, beat }: { boss: BossDefinition; beat: string }) {
  const isSnake = beat === "snake_bite";
  const lungeVariant = beat.startsWith("lunge:") ? (beat.slice("lunge:".length) as DogLungeVariant) : null;
  const ring = beat === "net_bonus" ? "border-sky-500/70 shadow-[0_0_22px_rgba(56,189,248,0.55)]"
    : beat === "vulnerable" ? "border-amber-500/70 shadow-[0_0_22px_rgba(251,191,36,0.55)]"
      : (beat === "howl" || isSnake || lungeVariant === "all_three") ? "border-red-600/70 shadow-[0_0_26px_rgba(220,38,38,0.7)]"
        : "border-destructive/70 shadow-[0_0_22px_rgba(220,38,38,0.55)]";
  const pose = boss.mechanic === "cerberus"
    ? (isSnake ? boss.snakeAttackImage : lungeVariant ? boss.dogLungeImages?.[lungeVariant] : boss.image) ?? boss.image
    : beat === "defensive" ? boss.chargeImage : boss.howlImage;
  return (
    <div className={`relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-2 transition-shadow duration-300 ${ring}`}>
      <img src={pose} alt={boss.name} className="h-full w-full object-cover" />
    </div>
  );
}

// -----------------------------------------------------------
// WORLD EVENT — a shared, timed spectacle every ludus can join. Unlike
// the fights above, nothing here is resolved server-side round-by-round:
// the "Titan's strength" bar is a client-side animation timed to the
// event's starts_at/ends_at, and the ambient damage-number feed (other
// ludus names) is simulated — not real aggregate data from other players
// (see strikeGlobalEvent in game.functions.ts for why: no shared counter
// means no contention). Your own strikes show their real damage in the
// ticker and are saved server-side; full standings are only revealed in
// the leaderboard once the event resolves.
// -----------------------------------------------------------
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const WORLD_EVENT_TICKER_NAMES = [
  "A gladiator", "A legionary veteran", "A Thracian champion", "A retiarius",
  "A Nubian slayer", "An Iberian swordsman", "A Praetorian washout", "A beast handler",
];
// A "crazy amount" of HP, purely for spectacle — see the section comment
// above. Only sampled at tick moments (each ticker line, real or
// simulated), not continuously, so the bar visibly drops in chunks
// instead of gliding smoothly.
const TITAN_MAX_HP = 1_000_000;
function titanHpAt(startMs: number, endMs: number): number {
  const remainingFraction = 1 - (Date.now() - startMs) / Math.max(1, endMs - startMs);
  return Math.max(0, Math.round(TITAN_MAX_HP * Math.max(0, Math.min(1, remainingFraction))));
}

function WorldEventFight({ state }: { state: State }) {
  const qc = useQueryClient();
  const fetchEvent = useServerFn(getGlobalEventState);
  const strikeFn = useServerFn(strikeGlobalEvent);
  const { data } = useQuery({
    queryKey: ["global-event"],
    queryFn: () => fetchEvent({}),
    refetchInterval: 15_000,
  });
  const eligible = state.gladiators.filter(gl => gl.status !== "dead");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ticker, setTicker] = useState<{ id: number; text: string; mine?: boolean }[]>([]);
  const tickerIdRef = useRef(0);
  const [titanHp, setTitanHp] = useState(TITAN_MAX_HP);
  const [remainingSec, setRemainingSec] = useState(0);
  const status = data?.event?.status;
  const startsAt = data?.event?.starts_at;
  const endsAt = data?.event?.ends_at;

  const strike = useMutation({
    mutationFn: (gladiatorId: string) => strikeFn({ data: { gladiatorId } }),
    onSuccess: (r) => {
      tickerIdRef.current += 1;
      setTicker(t => [...t.slice(-7), { id: tickerIdRef.current, text: `You strike for ${r.damage.toLocaleString()}!`, mine: true }]);
      if (startsAt && endsAt) setTitanHp(titanHpAt(new Date(startsAt).getTime(), new Date(endsAt).getTime()));
      if (!selectedIds.includes(r.gladiatorId)) setSelectedIds(ids => [...ids, r.gladiatorId]);
      qc.invalidateQueries({ queryKey: ["global-event"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Simulated ambient hits from "other players" — purely cosmetic, no
  // server round-trip, no real data. Also the only thing that updates the
  // strength bar / countdown outside of a strike, so both move in the
  // same chunky increments instead of a smooth glide.
  useEffect(() => {
    if (status !== "live" || !startsAt || !endsAt) return;
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    setTitanHp(titanHpAt(startMs, endMs));
    setRemainingSec(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)));
    const id = setInterval(() => {
      tickerIdRef.current += 1;
      const who = WORLD_EVENT_TICKER_NAMES[randInt(0, WORLD_EVENT_TICKER_NAMES.length - 1)];
      setTicker(t => [...t.slice(-7), { id: tickerIdRef.current, text: `${who} strikes for ${randInt(60, 850)}!` }]);
      setTitanHp(titanHpAt(startMs, endMs));
      setRemainingSec(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)));
    }, randInt(1000, 2200));
    return () => clearInterval(id);
  }, [status, startsAt, endsAt]);

  // Separate steady 1s tick just to keep per-fighter cooldown countdowns
  // (computed from Date.now() at render time, not stored state) accurate
  // — the ticker above only fires every 1-2.2s, too irregular for a "18s"
  // style countdown to feel right.
  const [, setCooldownTick] = useState(0);
  useEffect(() => {
    if (status !== "live") return;
    const id = setInterval(() => setCooldownTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (!data || !data.event) {
    return <p className="font-serif italic text-muted-foreground">No world event is active right now. Watch the banner above — Rome will call when it needs you.</p>;
  }
  const { event, myContributions, maxFighters, leaderboard } = data;
  const myByGladiator = new Map(myContributions.map(c => [c.gladiator_id, c]));

  if (event.status === "announced") {
    return (
      <Card className="overflow-hidden bg-card/50">
        <img src={porphyrionArenaBgImg} alt="" className="h-[40rem] w-full object-cover" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <img src={porphyrionSelectImg} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-border" />
            Porphyrion, King of the Giants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-serif text-sm italic text-muted-foreground">
            Something has broken through the gates of the underworld — worn thin, some say, by the endless brawls fought there. Jupiter calls every ludus in Rome to answer together. No single champion can stand against a Giant; only Rome entire.
          </p>
          <p className="text-accent">Breaks loose in {formatMinutes(minutesUntil(event.starts_at))}.</p>
          {maxFighters > 1 && (
            <p className="text-xs text-muted-foreground">Your Shard of the Titan's Chain lets you field up to {maxFighters} champions this time.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (event.status === "live") {
    const pct = (titanHp / TITAN_MAX_HP) * 100;
    const toggle = (id: string) => {
      setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id)
        : ids.length < maxFighters ? [...ids, id] : ids);
    };
    return (
      <Card className="overflow-hidden bg-card/50">
        <img src={porphyrionAttackImg} alt="" className="h-[40rem] w-full object-cover" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <img src={porphyrionSelectImg} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-border" />
            Porphyrion, King of the Giants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Titan's strength — {titanHp.toLocaleString()} / {TITAN_MAX_HP.toLocaleString()} HP</span>
              <span>{Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")} remaining</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-destructive transition-all duration-200 ease-out" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-background/40 p-2 font-mono text-xs text-muted-foreground">
            {ticker.length === 0 && <p className="italic">The sands await the first blow...</p>}
            {ticker.map(t => (
              <p key={t.id} className={t.mine ? "text-accent" : ""}>{t.text}</p>
            ))}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>Your champions</span>
              <span>{selectedIds.length}/{maxFighters} fielded</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {eligible.length === 0 && <p className="font-serif text-sm italic text-muted-foreground">No gladiators fit to fight.</p>}
              {eligible.map(gl => {
                const selected = selectedIds.includes(gl.id);
                const dim = !selected && selectedIds.length >= maxFighters;
                return (
                  <button
                    key={gl.id}
                    onClick={() => toggle(gl.id)}
                    disabled={dim}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
                  >
                    {gl.name}
                  </button>
                );
              })}
            </div>
            {maxFighters === 1 && (
              <p className="mt-1 text-xs text-muted-foreground">A Shard of the Titan's Chain (10% drop from this event) fields more champions next time.</p>
            )}
          </div>

          {selectedIds.length > 0 && (
            <ul className="space-y-2">
              {selectedIds.map(id => {
                const gl = eligible.find(g => g.id === id);
                if (!gl) return null;
                const contribution = myByGladiator.get(id);
                const strikesUsed = contribution?.strikes_used ?? 0;
                const lastStrikeMs = contribution?.last_strike_at ? new Date(contribution.last_strike_at).getTime() : 0;
                const cooldownLeft = Math.max(0, GLOBAL_EVENT_STRIKE_COOLDOWN_SEC - Math.floor((Date.now() - lastStrikeMs) / 1000));
                const onCooldown = cooldownLeft > 0;
                return (
                  <li key={id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <span className="text-sm font-display">{gl.name}</span>
                    <span className="flex items-center gap-3">
                      {strikesUsed > 0 && <span className="text-xs text-muted-foreground">{strikesUsed} strike{strikesUsed === 1 ? "" : "s"} landed</span>}
                      <Button size="sm" disabled={onCooldown || strike.isPending} onClick={() => strike.mutate(id)}>
                        {onCooldown ? `${cooldownLeft}s` : "Strike!"}
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  // resolved
  return (
    <Card className="overflow-hidden bg-card/50">
      <img src={porphyrionDefeatedImg} alt="" className="h-[40rem] w-full object-cover" />
      <CardHeader>
        <CardTitle className="font-display text-lg">Rome Has Held</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-serif text-sm italic text-muted-foreground">
          Porphyrion is driven back to Tartarus. {leaderboard.length} champion{leaderboard.length === 1 ? "" : "s"} answered the call.
        </p>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one struck a blow this time.</p>
        ) : (
          <ul className="divide-y divide-border">
            {leaderboard.map((row, i) => (
              <li key={`${row.owner_id}-${row.gladiator_name}`} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant={i < 3 ? "default" : "outline"}>{i + 1}</Badge>
                  <span className="font-display">{row.ludus_name}</span>
                  <span className="text-muted-foreground">({row.gladiator_name})</span>
                </span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span>{row.damage_dealt.toLocaleString()} dmg</span>
                  <span className="text-accent">+{row.reward_denarii}d</span>
                  <span className="text-accent">+{row.reward_xp}xp</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------
// Animated battle replay — plays before the reward/result dialog.
// The fight is fully resolved server-side (fair, ungameable); this just
// gives the already-computed rounds a round-by-round visual presentation.
// -----------------------------------------------------------

// Placeholder for opponents that aren't real gladiator rows (pit-fight NPCs,
// team-battle enemy cohorts) — no portrait asset exists for them.
function GenericFoeAvatar({ size = 96 }: { size?: number }) {
  const s = size;
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full border border-destructive/50 shadow-[inset_0_0_18px_rgba(0,0,0,0.55)]"
      style={{ width: s, height: s, background: "radial-gradient(circle at 30% 20%, hsl(0 30% 20%), hsl(0 40% 6%) 75%)" }}
    >
      <Swords className="text-destructive" style={{ width: s * 0.45, height: s * 0.45 }} />
    </div>
  );
}

// Stacked cluster of small portraits for team-battle "my side" — also used
// (at a larger size) for the boss-fight screens, so it scales in step with
// BossPortrait rather than looking mismatched next to it.
function PortraitCluster({ gladiators, size = 44 }: { gladiators: PortraitSubject[]; size?: number }) {
  return (
    <div className="flex" style={{ marginLeft: Math.round(size * 0.27) }}>
      {gladiators.map((g, i) => (
        <div
          key={g.id}
          className="rounded-full ring-2 ring-background"
          style={{ zIndex: gladiators.length - i, marginLeft: -Math.round(size * 0.27) }}
        >
          <FaceAvatar g={g} size={size} />
        </div>
      ))}
    </div>
  );
}

// Locates the animated rounds' log lines within the full narrative log, so
// the pre-fight setup lines and post-fight outcome lines can be shown
// instantly while only the round-by-round exchanges animate.
function splitBattleLog(log: string[], rounds: FightRound[]): { introLines: string[]; outroLines: string[] } {
  if (rounds.length === 0) return { introLines: log, outroLines: [] };
  const firstIdx = log.indexOf(rounds[0].text);
  const lastIdx = log.lastIndexOf(rounds[rounds.length - 1].text);
  return {
    introLines: firstIdx >= 0 ? log.slice(0, firstIdx) : log,
    outroLines: lastIdx >= 0 ? log.slice(lastIdx + 1) : [],
  };
}

function FighterPanel({ label, portrait, hp, maxHp, hit }: { label: string; portrait: ReactNode; hp: number; maxHp: number; hit: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`rounded-full transition-transform duration-150 ${hit ? "scale-90 ring-4 ring-destructive/80" : ""}`}>
        {portrait}
      </div>
      <div className="max-w-[140px] truncate font-display text-sm">{label}</div>
      <div className="h-2 w-full max-w-[140px] overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-500 ease-out ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-destructive"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">{Math.max(0, Math.round(hp))} / {maxHp} HP</div>
    </div>
  );
}

function BattleAnimation({
  myLabel, myPortrait, oppLabel, oppPortrait, myMaxHp, myStartHp, oppMaxHp, rounds, log, onComplete,
}: {
  myLabel: string;
  myPortrait: ReactNode;
  oppLabel: string;
  oppPortrait: ReactNode;
  myMaxHp: number;
  myStartHp?: number;
  oppMaxHp: number;
  rounds: FightRound[];
  log: string[];
  onComplete: () => void;
}) {
  const { introLines, outroLines } = splitBattleLog(log, rounds);
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [hitSide, setHitSide] = useState<"me" | "opponent" | null>(null);

  useEffect(() => {
    if (skipped) { onComplete(); return; }
    if (step > rounds.length) {
      const t = setTimeout(onComplete, 900);
      return () => clearTimeout(t);
    }
    if (step === 0) {
      const t = setTimeout(() => setStep(1), 650);
      return () => clearTimeout(t);
    }
    const round = rounds[step - 1];
    const hitTimer = setTimeout(() => setHitSide(round.attacker === "me" ? "opponent" : "me"), 150);
    const clearTimer = setTimeout(() => setHitSide(null), 500);
    const nextTimer = setTimeout(() => setStep(s => s + 1), 700);
    return () => { clearTimeout(hitTimer); clearTimeout(clearTimer); clearTimeout(nextTimer); };
  }, [step, skipped, rounds, onComplete]);

  const currentRound = step > 0 && step <= rounds.length ? rounds[step - 1] : null;
  const myHp = currentRound ? currentRound.myHp : (myStartHp ?? myMaxHp);
  const oppHp = currentRound ? currentRound.oppHp : oppMaxHp;
  const visibleLines = [
    ...introLines,
    ...rounds.slice(0, step).map(r => r.text),
    ...(step > rounds.length ? outroLines : []),
  ];

  return (
    <Dialog open>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-xl">The sand awaits...</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <FighterPanel label={myLabel} portrait={myPortrait} hp={myHp} maxHp={myMaxHp} hit={hitSide === "me"} />
          <Swords className="h-6 w-6 text-muted-foreground" />
          <FighterPanel label={oppLabel} portrait={oppPortrait} hp={oppHp} maxHp={oppMaxHp} hit={hitSide === "opponent"} />
        </div>
        <ol className="mt-2 max-h-40 space-y-1 overflow-y-auto font-serif text-sm">
          {visibleLines.map((line, i) => (
            <li key={i} className="border-l-2 border-border pl-3">{line}</li>
          ))}
        </ol>
        <Button variant="ghost" className="w-full" onClick={() => setSkipped(true)}>
          Skip
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------
// Shared result view
// -----------------------------------------------------------
function ResultView({ result, onClose, image }: { result: { won: boolean; log: string[] }; onClose: () => void; image?: string }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{result.won ? "Victory!" : "Defeat"}</DialogTitle>
        </DialogHeader>
        {image ? (
          <img src={image} alt={result.won ? "Victory" : "Defeat"} className="h-48 w-full rounded-lg object-cover" />
        ) : (
          <div className={`rounded-lg p-3 text-center ${result.won ? "bg-accent/20" : "bg-muted"}`}>
            {result.won ? <Trophy className="mx-auto h-8 w-8 text-accent" /> : <Skull className="mx-auto h-8 w-8 text-muted-foreground" />}
          </div>
        )}
        <ol className="max-h-72 space-y-1 overflow-y-auto font-serif text-sm">
          {result.log.map((line, i) => (
            <li key={i} className="border-l-2 border-border pl-3">{line}</li>
          ))}
        </ol>
        <Button className="w-full" onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  );
}
