import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getLudusState, fightMatch, fightTeamBattle,
  postPvpChallenge, cancelPvpChallenge, listOpenPvpChallenges, acceptPvpChallenge,
  matchRating,
  ARENA_TIERS, tierUnlockReason,
  TEAM_BATTLES, teamBattleRequirementError, WEAPON_LABELS,
  healGladiator, maxHealth, honorGladiator,
} from "@/lib/game.functions";
import type { FightRound } from "@/lib/game.functions";
import { FaceAvatar } from "./ludus";
import type { PortraitSubject } from "./ludus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Coins, Swords, Trophy, Skull, Award, Cat, ArrowLeft, Users, Shield, Heart, Flame } from "lucide-react";


function HealButton({ g }: { g: Gladiator }) {
  const qc = useQueryClient();
  const heal = useServerFn(healGladiator);
  const injured = !!(g.injury_until && new Date(g.injury_until) > new Date());
  const needsHeal = g.health < maxHealth(g.stamina) || injured;
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
      onClick={(e) => { e.stopPropagation(); mut.mutate(); }}
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

function ArenaPage() {
  const fetchState = useServerFn(getLudusState);
  const { data } = useSuspenseQuery({ queryKey: ["ludus"], queryFn: () => fetchState() });
  const denarii = data.profile?.denarii ?? 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/ludus" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="font-display text-xl tracking-widest text-primary">The Arena</div>
              <div className="mt-1 flex items-center gap-4 text-sm font-serif italic text-muted-foreground">
                <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-accent" /> {denarii} denarii</span>
                <span className="flex items-center gap-1"><Award className="h-4 w-4 text-accent" /> {data.profile?.reputation ?? 0} fame</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/info"><Button variant="outline" size="sm">Codex</Button></Link>
            <Link to="/ludus"><Button variant="ghost" size="sm">Back to Ludus</Button></Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="pits" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="pits"><Swords className="mr-1 h-4 w-4" /> Pit Fights</TabsTrigger>
            <TabsTrigger value="pvp"><Shield className="mr-1 h-4 w-4" /> Rival Ludi</TabsTrigger>
            <TabsTrigger value="team"><Users className="mr-1 h-4 w-4" /> Team Battles</TabsTrigger>
          </TabsList>

          <TabsContent value="pits" className="mt-6"><PitFights state={data} /></TabsContent>
          <TabsContent value="pvp" className="mt-6"><PvpFights state={data} /></TabsContent>
          <TabsContent value="team" className="mt-6"><TeamFights state={data} /></TabsContent>
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

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Your gladiators</div>
        <div className="space-y-2">
          {state.gladiators.length === 0 && <p className="font-serif italic text-muted-foreground">No gladiators yet.</p>}
          {state.gladiators.filter(gl => gl.status !== "dead").map(gl => {
            const injured = gl.injury_until && new Date(gl.injury_until) > new Date();
            const disabled = injured || gl.health < 30;
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
                  <div className="mt-0.5 text-xs text-muted-foreground">{gl.wins}W/{gl.losses}L · HP {gl.health}</div>
                </button>
                <HealButton g={gl} />
              </div>
            );
          })}
        </div>
      </div>

      {g ? (
        <TierPicker key={g.id} g={g} state={state} />
      ) : (
        <div className="inscribed ornate-border rounded-lg p-12 text-center font-serif italic text-muted-foreground">
          Select a rested gladiator to send to the pits.
        </div>
      )}
    </div>
  );
}

function TierPicker({ g, state }: { g: Gladiator; state: State }) {
  const qc = useQueryClient();
  const fight = useServerFn(fightMatch);
  const [difficulty, setDifficulty] = useState<string>("backwater");
  const [battle, setBattle] = useState<Awaited<ReturnType<typeof fight>> | null>(null);
  const [animating, setAnimating] = useState(false);

  const mut = useMutation({
    mutationFn: () => fight({ data: { gladiatorId: g.id, difficulty } }),
    onSuccess: (r) => { setBattle(r); setAnimating(true); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (battle && animating) {
    return (
      <BattleAnimation
        myLabel={g.name}
        myPortrait={<FaceAvatar g={g} size={96} />}
        oppLabel={battle.opponentName}
        oppPortrait={<GenericFoeAvatar size={96} />}
        maxHp={battle.maxHp}
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
              disabled={mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "The crowd holds its breath..." : "Fight!"}
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
          onClick={() => post.mutate()}
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
        maxHp={battle.maxHp}
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
            {eligible.map(gl => (
              <button
                key={gl.id}
                disabled={accept.isPending}
                onClick={() => setMyId(gl.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${myId === gl.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
              >
                <span className="font-display">{gl.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">R{matchRating(gl)}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="font-serif italic text-muted-foreground">Scouts scan the provinces...</p>}
        {data && data.openChallenges.length === 0 && (
          <p className="font-serif italic text-muted-foreground">No rival ludi have open challenges. Return later.</p>
        )}
        {data && data.openChallenges.map(c => {
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
                  onClick={() => {
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
              onClick={() => mut.mutate(fallen.id)}
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
  const qc = useQueryClient();
  const fightFn = useServerFn(fightTeamBattle);
  const [outcome, setOutcome] = useState<Awaited<ReturnType<typeof fightFn>> | null>(null);
  const [animating, setAnimating] = useState(false);
  const [fightingTeam, setFightingTeam] = useState<Gladiator[]>([]);

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
        maxHp={outcome.maxHp}
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
            let requirement = `${b.size} gladiators`;
            if (b.requireClass) requirement += ` · all ${b.requireClass}`;
            if (b.requireBeast) requirement += ` · ${b.requireBeast} beast`;
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
                  <div className="text-xs text-accent">~{b.reward}d · +{b.rep} fame</div>
                </div>
                <div className="mt-1 font-serif text-xs italic text-muted-foreground">{b.flavor}</div>
                <div className="mt-1 text-xs text-muted-foreground">Requires: {requirement}</div>
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
            const disabled = injured || gl.health < 30;
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
                  <div className="text-xs text-muted-foreground">{gl.is_beast ? "Beast" : gl.class} · HP {gl.health}</div>
                </button>
                <HealButton g={gl} />
              </div>
            );
          })}
        </div>
        {reqErr && <p className="mt-3 text-xs text-destructive">{reqErr}</p>}
        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={mut.isPending || selectedIds.length !== battle.size || !!reqErr}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Enter the sand..." : "Begin Battle"}
        </Button>
      </div>
    </div>
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

// Stacked cluster of small portraits for team-battle "my side".
function PortraitCluster({ gladiators }: { gladiators: PortraitSubject[] }) {
  return (
    <div className="flex -space-x-3">
      {gladiators.map((g, i) => (
        <div key={g.id} className="rounded-full ring-2 ring-background" style={{ zIndex: gladiators.length - i }}>
          <FaceAvatar g={g} size={44} />
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
  myLabel, myPortrait, oppLabel, oppPortrait, maxHp, rounds, log, onComplete,
}: {
  myLabel: string;
  myPortrait: ReactNode;
  oppLabel: string;
  oppPortrait: ReactNode;
  maxHp: number;
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
  const myHp = currentRound ? currentRound.myHp : maxHp;
  const oppHp = currentRound ? currentRound.oppHp : maxHp;
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
          <FighterPanel label={myLabel} portrait={myPortrait} hp={myHp} maxHp={maxHp} hit={hitSide === "me"} />
          <Swords className="h-6 w-6 text-muted-foreground" />
          <FighterPanel label={oppLabel} portrait={oppPortrait} hp={oppHp} maxHp={maxHp} hit={hitSide === "opponent"} />
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
function ResultView({ result, onClose }: { result: { won: boolean; log: string[] }; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{result.won ? "Victory!" : "Defeat"}</DialogTitle>
        </DialogHeader>
        <div className={`rounded-lg p-3 text-center ${result.won ? "bg-accent/20" : "bg-muted"}`}>
          {result.won ? <Trophy className="mx-auto h-8 w-8 text-accent" /> : <Skull className="mx-auto h-8 w-8 text-muted-foreground" />}
        </div>
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
