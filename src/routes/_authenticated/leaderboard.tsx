import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trophy, Crown, Swords, Skull, Medal, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/app-header";
import { getLeaderboards, getAchievementLeaderboard, WEAPON_LABELS } from "@/lib/game.functions";

// Ranked lists default to the top 10 — "Show 10 more" reveals the rest
// (each source list is already capped at 25 server-side), and "Show less"
// folds back once expanded. Kept as a plain count rather than true
// pagination since 25 rows is cheap to hold client-side either way.
const PAGE_SIZE = 10;
function ShowMoreButton({ visible, total, onMore, onLess }: { visible: number; total: number; onMore: () => void; onLess: () => void }) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="pt-2 text-center">
      {visible < total ? (
        <Button variant="ghost" size="sm" onClick={onMore} className="text-xs text-muted-foreground">
          <ChevronDown className="mr-1 h-3.5 w-3.5" /> Show {Math.min(PAGE_SIZE, total - visible)} more
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={onLess} className="text-xs text-muted-foreground">
          <ChevronUp className="mr-1 h-3.5 w-3.5" /> Show less
        </Button>
      )}
    </div>
  );
}

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
  const fetchAchievements = useServerFn(getAchievementLeaderboard);
  const { data: achData, isLoading: achLoading } = useQuery({
    queryKey: ["achievement-leaderboard"],
    queryFn: () => fetchAchievements({}),
  });

  const [ludiVisible, setLudiVisible] = useState(PAGE_SIZE);
  const [gladVisible, setGladVisible] = useState(PAGE_SIZE);
  const [achVisible, setAchVisible] = useState(PAGE_SIZE);
  const ludiList = data?.ludi ?? [];
  const gladList = data?.gladiators ?? [];
  const achList = achData?.ludi ?? [];

  return (
    <div className="min-h-screen">
      <AppHeader
        backTo="/ludus"
        title={<span className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Hall of Champions</span>}
      />

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
            <Crown className="h-5 w-5" /> Most Famous Ludi
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Consulting the heralds…</p>}
          <div className="space-y-1">
            {ludiList.slice(0, ludiVisible).map((l) => (
              <Link
                key={l.id}
                to="/ludi/$id"
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
            {!isLoading && ludiList.length === 0 && (
              <p className="text-sm italic text-muted-foreground">No ludi have earned fame yet.</p>
            )}
          </div>
          <ShowMoreButton
            visible={ludiVisible}
            total={ludiList.length}
            onMore={() => setLudiVisible(v => v + PAGE_SIZE)}
            onLess={() => setLudiVisible(PAGE_SIZE)}
          />
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
            <Swords className="h-5 w-5" /> Most Famous Gladiators
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Counting the wreaths…</p>}
          <div className="space-y-1">
            {gladList.slice(0, gladVisible).map((g) => (
              <div key={g.id} className="flex items-center justify-between border-b border-border/40 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-right font-mono ${g.rank <= 3 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {g.rank}
                  </span>
                  <div>
                    <div className="font-serif text-foreground">
                      {g.name}
                      {g.best_rank && g.best_rank < g.rank && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">best #{g.best_rank}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Lv {g.level} · {g.is_beast ? WEAPON_LABELS[g.weapon_type] ?? g.class : WEAPON_LABELS[g.weapon_type] ?? g.weapon_type} ·{" "}
                      <Link to="/ludi/$id" params={{ id: g.owner_id }} className="underline-offset-4 hover:text-primary hover:underline">
                        {g.ludus_name}
                      </Link>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono">{g.wins}W / {g.losses}L</Badge>
              </div>
            ))}
            {!isLoading && gladList.length === 0 && (
              <p className="text-sm italic text-muted-foreground">No living gladiators yet.</p>
            )}
          </div>
          <ShowMoreButton
            visible={gladVisible}
            total={gladList.length}
            onMore={() => setGladVisible(v => v + PAGE_SIZE)}
            onLess={() => setGladVisible(PAGE_SIZE)}
          />
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
            <Skull className="h-5 w-5" /> Boss Slayers
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Consulting the myths…</p>}
          <div className="space-y-1">
            {(data?.bosses ?? []).map((b) => (
              <div key={b.key} className="border-b border-border/40 py-2 text-sm">
                <div className="font-serif text-foreground">{b.name}</div>
                {b.champion ? (
                  <div className="mt-0.5 flex items-center justify-between">
                    <Link
                      to="/ludi/$id"
                      params={{ id: b.champion.owner_id }}
                      className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {b.champion.ludus_name}
                    </Link>
                    <Badge variant="secondary" className="font-mono">{b.champion.kills} kill{b.champion.kills === 1 ? "" : "s"}</Badge>
                  </div>
                ) : (
                  <span className="text-xs italic text-muted-foreground">No confirmed kills yet</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
            <Medal className="h-5 w-5" /> Achievement Leaders
          </div>
          {achLoading && <p className="text-sm text-muted-foreground">Counting the badges…</p>}
          <div className="space-y-1">
            {achList.slice(0, achVisible).map((l) => (
              <Link
                key={l.id}
                to="/ludi/$id"
                params={{ id: l.id }}
                className="flex items-center justify-between border-b border-border/40 py-2 text-sm transition hover:bg-secondary/40"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-right font-mono ${l.rank <= 3 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {l.rank}
                  </span>
                  <span className="font-serif text-foreground underline-offset-4 hover:underline">{l.ludus_name}</span>
                </div>
                <Badge variant="secondary" className="font-mono">{l.badges} / {achData?.totalBadges ?? 0} badges</Badge>
              </Link>
            ))}
            {!achLoading && achList.length === 0 && (
              <p className="text-sm italic text-muted-foreground">No badges earned yet.</p>
            )}
          </div>
          <ShowMoreButton
            visible={achVisible}
            total={achList.length}
            onMore={() => setAchVisible(v => v + PAGE_SIZE)}
            onLess={() => setAchVisible(PAGE_SIZE)}
          />
        </Card>
      </main>
    </div>
  );
}
