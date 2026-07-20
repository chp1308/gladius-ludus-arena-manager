import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trophy, Crown, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLeaderboards, WEAPON_LABELS } from "@/lib/game.functions";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Hall of Champions — Gladius Ludus" },
      { name: "description", content: "Global rankings of the most famous ludi and gladiators across the Empire." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const fetchBoards = useServerFn(getLeaderboards);
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboards"],
    queryFn: () => fetchBoards({}),
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/ludus" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2 font-display text-xl tracking-widest text-primary">
              <Trophy className="h-5 w-5" /> Hall of Champions
            </div>
          </div>
          <Link to="/ludus"><Button variant="ghost" size="sm">Back to Ludus</Button></Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
            <Crown className="h-5 w-5" /> Most Famous Ludi
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Consulting the heralds…</p>}
          <div className="space-y-1">
            {(data?.ludi ?? []).map((l) => (
              <Link
                key={l.id}
                to="/ludus/$id"
                params={{ id: l.id }}
                className="flex items-center justify-between border-b border-border/40 py-2 text-sm transition hover:bg-secondary/40"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-right font-mono ${l.rank <= 3 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {l.rank}
                  </span>
                  <span className="font-serif text-foreground underline-offset-4 hover:underline">{l.ludus_name}</span>
                  {l.best_rank && l.best_rank < l.rank && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">best #{l.best_rank}</span>
                  )}
                </div>
                <Badge variant="secondary" className="font-mono">{l.reputation} fame</Badge>
              </Link>
            ))}
            {!isLoading && (data?.ludi ?? []).length === 0 && (
              <p className="text-sm italic text-muted-foreground">No ludi have earned fame yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
            <Swords className="h-5 w-5" /> Most Famous Gladiators
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Counting the wreaths…</p>}
          <div className="space-y-1">
            {(data?.gladiators ?? []).map((g) => (
              <div key={g.id} className="flex items-center justify-between border-b border-border/40 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-right font-mono ${g.rank <= 3 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {g.rank}
                  </span>
                  <div>
                    <div className="font-serif text-foreground">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Lv {g.level} · {g.is_beast ? WEAPON_LABELS[g.weapon_type] ?? g.class : `${g.class} · ${WEAPON_LABELS[g.weapon_type] ?? g.weapon_type}`} · {g.ludus_name}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono">{g.wins}W / {g.losses}L</Badge>
              </div>
            ))}
            {!isLoading && (data?.gladiators ?? []).length === 0 && (
              <p className="text-sm italic text-muted-foreground">No living gladiators yet.</p>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
