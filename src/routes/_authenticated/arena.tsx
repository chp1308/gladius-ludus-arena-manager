import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getLudusState, fightMatch, fightPvp, fightTeamBattle,
  listRivalGladiators, ARENA_TIERS, tierUnlockReason,
  TEAM_BATTLES, teamBattleRequirementError, WEAPON_LABELS,
  healGladiator,
} from "@/lib/game.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Coins, Swords, Trophy, Skull, Award, Cat, ArrowLeft, Users, Shield, Heart } from "lucide-react";

function HealButton({ g }: { g: Gladiator }) {
  const qc = useQueryClient();
  const heal = useServerFn(healGladiator);
  const injured = !!(g.injury_until && new Date(g.injury_until) > new Date());
  const needsHeal = g.health < 100 || injured;
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
          <Link to="/ludus"><Button variant="ghost" size="sm">Back to Ludus</Button></Link>
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
          {state.gladiators.map(gl => {
            const injured = gl.injury_until && new Date(gl.injury_until) > new Date();
            const disabled = injured || gl.health < 30;
            return (
              <button
                key={gl.id}
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
  const [result, setResult] = useState<{ won: boolean; log: string[] } | null>(null);

  const mut = useMutation({
    mutationFn: () => fight({ data: { gladiatorId: g.id, difficulty } }),
    onSuccess: (r) => { setResult({ won: r.won, log: r.log }); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result) return <ResultView result={result} onClose={() => setResult(null)} />;

  return (
    <div className="space-y-4">
      <p className="font-serif italic text-muted-foreground">
        {g.name} — Lv {g.level} · {g.wins}W · Ludus fame {state.profile?.reputation ?? 0}
      </p>
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
              {lock && <div className="mt-1 text-xs text-destructive">🔒 {lock}</div>}
            </button>
          );
        })}
      </div>
      <Button className="w-full" size="lg" disabled={mut.isPending} onClick={() => mut.mutate()}>
        {mut.isPending ? "The crowd holds its breath..." : "Fight!"}
      </Button>
    </div>
  );
}

// -----------------------------------------------------------
// PVP — challenge other players' gladiators
// -----------------------------------------------------------
function PvpFights({ state }: { state: State }) {
  const eligible = state.gladiators.filter(g => g.health >= 30 && (!g.injury_until || new Date(g.injury_until) < new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(eligible[0]?.id ?? null);
  const g = state.gladiators.find(x => x.id === selectedId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Your champion</div>
        <div className="space-y-2">
          {state.gladiators.length === 0 && <p className="font-serif italic text-muted-foreground">No gladiators yet.</p>}
          {state.gladiators.map(gl => {
            const injured = gl.injury_until && new Date(gl.injury_until) > new Date();
            const disabled = injured || gl.health < 30;
            return (
              <button
                key={gl.id}
                disabled={!!disabled}
                onClick={() => setSelectedId(gl.id)}
                className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedId === gl.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
                }`}
              >
                <div className="flex items-center justify-between font-display">
                  <span>{gl.name}</span>
                  <Badge variant="outline">Lv {gl.level}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{WEAPON_LABELS[gl.weapon_type]}</div>
              </button>
            );
          })}
        </div>
      </div>

      {g ? <RivalList myGladiator={g} /> : (
        <div className="inscribed ornate-border rounded-lg p-12 text-center font-serif italic text-muted-foreground">
          Select a champion to challenge rivals.
        </div>
      )}
    </div>
  );
}

function RivalList({ myGladiator }: { myGladiator: Gladiator }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRivalGladiators);
  const fightFn = useServerFn(fightPvp);
  const [result, setResult] = useState<{ won: boolean; log: string[] } | null>(null);

  const { data: rivals, isLoading } = useQuery({
    queryKey: ["rivals", myGladiator.id],
    queryFn: () => listFn({ data: { myGladiatorId: myGladiator.id } }),
  });

  const mut = useMutation({
    mutationFn: (opponentId: string) => fightFn({ data: { myGladiatorId: myGladiator.id, opponentGladiatorId: opponentId } }),
    onSuccess: (r) => {
      setResult({ won: r.won, log: r.log });
      qc.invalidateQueries({ queryKey: ["ludus"] });
      qc.invalidateQueries({ queryKey: ["rivals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result) return <ResultView result={result} onClose={() => setResult(null)} />;
  if (isLoading) return <p className="font-serif italic text-muted-foreground">Scouts search the provinces...</p>;
  if (!rivals || rivals.length === 0) return (
    <div className="inscribed ornate-border rounded-lg p-8 text-center font-serif italic text-muted-foreground">
      No rival ludi have active gladiators to fight. Return later.
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="font-serif italic text-muted-foreground">
        {myGladiator.name} seeks a worthy foe. Victory brings great fame.
      </p>
      {rivals.map(r => (
        <div key={r.id} className="rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 font-display">
                {r.is_beast && <Cat className="h-4 w-4 text-accent" />}
                {r.name}
                <Badge variant="outline">Lv {r.level}</Badge>
                <Badge variant="secondary">{WEAPON_LABELS[r.weapon_type] ?? r.weapon_type}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {r.ludus_name} · fame {r.ludus_fame} · {r.wins}W/{r.losses}L · HP {r.health}
              </div>
            </div>
            <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate(r.id)}>
              Challenge
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------
// TEAM BATTLES
// -----------------------------------------------------------
function TeamFights({ state }: { state: State }) {
  const [battleKey, setBattleKey] = useState<string>(TEAM_BATTLES[0].key);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ won: boolean; log: string[] } | null>(null);
  const qc = useQueryClient();
  const fightFn = useServerFn(fightTeamBattle);

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
      setResult({ won: r.won, log: r.log });
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["ludus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result) return <ResultView result={result} onClose={() => setResult(null)} />;

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
          {state.gladiators.map(gl => {
            const injured = gl.injury_until && new Date(gl.injury_until) > new Date();
            const disabled = injured || gl.health < 30;
            const selected = selectedIds.includes(gl.id);
            const classOk = !battle.requireClass || (!gl.is_beast && gl.class === battle.requireClass);
            const dim = !selected && !classOk;
            return (
              <button
                key={gl.id}
                disabled={!!disabled}
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
