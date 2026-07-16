import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLudusState, recruitGladiator, trainGladiator, upgradeEquipment,
  healGladiator, dismissGladiator, fightMatch,
} from "@/lib/game.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Coins, Swords, Trophy, Shield, Dumbbell, Heart, X, Skull, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ludus")({
  component: LudusPage,
});

type Gladiator = Awaited<ReturnType<typeof getLudusState>>["gladiators"][number];

function LudusPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchState = useServerFn(getLudusState);
  const { data } = useSuspenseQuery({ queryKey: ["ludus"], queryFn: () => fetchState() });

  const recruit = useServerFn(recruitGladiator);
  const recruitMut = useMutation({
    mutationFn: () => recruit(),
    onSuccess: () => { toast.success("A new gladiator joins your ludus."); qc.invalidateQueries({ queryKey: ["ludus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="font-display text-xl tracking-widest text-primary">{data.profile?.ludus_name ?? "Ludus"}</div>
            <div className="mt-1 flex items-center gap-4 text-sm font-serif italic text-muted-foreground">
              <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-accent" /> {data.profile?.denarii ?? 0} denarii</span>
              <span className="flex items-center gap-1"><Award className="h-4 w-4 text-accent" /> {data.profile?.reputation ?? 0} fame</span>
              <span>{data.gladiators.length} gladiators</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="ludus" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="ludus">Ludus</TabsTrigger>
            <TabsTrigger value="recruit">Recruit</TabsTrigger>
            <TabsTrigger value="history">Chronicle</TabsTrigger>
          </TabsList>

          <TabsContent value="ludus" className="mt-6">
            {data.gladiators.length === 0 ? (
              <div className="inscribed ornate-border rounded-lg p-12 text-center">
                <p className="font-serif text-lg italic text-muted-foreground">Your ludus is empty. Recruit your first gladiator.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.gladiators.map((g) => <GladiatorCard key={g.id} g={g} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recruit" className="mt-6">
            <Card className="inscribed ornate-border">
              <CardHeader>
                <CardTitle className="font-display">The Slave Market</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-serif italic text-muted-foreground">
                  Bring in a fresh recruit from the provinces. Stats are unknown until they arrive.
                </p>
                <Button
                  size="lg"
                  onClick={() => recruitMut.mutate()}
                  disabled={recruitMut.isPending || (data.profile?.denarii ?? 0) < 100}
                >
                  Recruit gladiator · 100 denarii
                </Button>
              </CardContent>
            </Card>
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
                              {m.difficulty} · {new Date(m.created_at).toLocaleString()}
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

function GladiatorCard({ g }: { g: Gladiator }) {
  const qc = useQueryClient();
  const train = useServerFn(trainGladiator);
  const upgrade = useServerFn(upgradeEquipment);
  const heal = useServerFn(healGladiator);
  const dismiss = useServerFn(dismissGladiator);
  const fight = useServerFn(fightMatch);

  const [fightOpen, setFightOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<"novice" | "veteran" | "champion">("novice");
  const [lastResult, setLastResult] = useState<{ won: boolean; log: string[] } | null>(null);

  const injured = g.injury_until && new Date(g.injury_until) > new Date();
  const injuryDaysLeft = injured ? Math.ceil((new Date(g.injury_until!).getTime() - Date.now()) / 86400_000) : 0;

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
  const fightMut = useMutation({
    mutationFn: () => fight({ data: { gladiatorId: g.id, difficulty } }),
    onSuccess: (r) => {
      setLastResult({ won: r.won, log: r.log });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats: [string, number, string][] = [
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
            <CardTitle className="font-display text-xl">{g.name}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{g.class}</Badge>
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
        {/* Health */}
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

        {/* XP */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>XP</span>
            <span>{g.experience} / {g.level * 100}</span>
          </div>
          <Progress value={(g.experience / (g.level * 100)) * 100} className="h-1.5" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map(([label, val, key]) => (
            <button
              key={key}
              onClick={() => trainMut.mutate(key as "strength")}
              disabled={trainMut.isPending || !!injured}
              className="rounded border border-border bg-secondary/40 p-2 text-center transition hover:border-primary hover:bg-secondary disabled:opacity-50"
              title="Train (50 denarii)"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="font-display text-lg">{val}</div>
            </button>
          ))}
        </div>

        {/* Equipment */}
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

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1"
            disabled={!!injured || g.health < 30}
            onClick={() => { setLastResult(null); setFightOpen(true); }}
          >
            <Swords className="mr-1 h-4 w-4" /> To the Arena
          </Button>
          <Button size="sm" variant="outline" onClick={() => healMut.mutate()} disabled={healMut.isPending || (g.health === 100 && !injured)}>
            <Heart className="mr-1 h-4 w-4" /> Heal
          </Button>
        </div>
      </CardContent>

      <Dialog open={fightOpen} onOpenChange={(o) => { setFightOpen(o); if (!o) setLastResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {lastResult ? (lastResult.won ? "Victory!" : "Defeat") : "Choose your foe"}
            </DialogTitle>
          </DialogHeader>
          {!lastResult ? (
            <div className="space-y-4">
              <p className="font-serif italic text-muted-foreground">
                {g.name} will meet one of Rome's champions. Choose the challenge.
              </p>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as "novice")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novice">Novice — safe purse (~80 denarii)</SelectItem>
                  <SelectItem value="veteran">Veteran — good coin (~180 denarii)</SelectItem>
                  <SelectItem value="champion">Champion — glory or ruin (~400 denarii)</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" disabled={fightMut.isPending} onClick={() => fightMut.mutate()}>
                {fightMut.isPending ? "The crowd holds its breath..." : "Fight!"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-lg p-3 text-center ${lastResult.won ? "bg-accent/20" : "bg-muted"}`}>
                {lastResult.won ? <Trophy className="mx-auto h-8 w-8 text-accent" /> : <Skull className="mx-auto h-8 w-8 text-muted-foreground" />}
              </div>
              <ol className="max-h-72 space-y-1 overflow-y-auto font-serif text-sm">
                {lastResult.log.map((line, i) => (
                  <li key={i} className="border-l-2 border-border pl-3">{line}</li>
                ))}
              </ol>
              <Button className="w-full" onClick={() => setFightOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
