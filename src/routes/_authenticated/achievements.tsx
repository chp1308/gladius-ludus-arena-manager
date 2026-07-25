import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Medal, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAchievementProgress, ACHIEVEMENTS, type AchievementCategory } from "@/lib/game.functions";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Gladius Ludus" },
      { name: "description", content: "Badges earned by your ludus across training, combat, wealth, and renown." },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const fetchProgress = useServerFn(getAchievementProgress);
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetchProgress({}),
  });
  const progress: Record<string, number> = data?.progress ?? {};

  const totalBadges = ACHIEVEMENTS.length * 5;
  const earnedBadges = ACHIEVEMENTS.reduce((sum, cat) => {
    const val = progress[cat.key] ?? 0;
    return sum + cat.tiers.filter(t => val >= t).length;
  }, 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/ludus" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2 font-display text-xl tracking-widest text-primary">
              <Medal className="h-5 w-5" /> Achievements
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-serif text-sm italic text-muted-foreground">
              {earnedBadges} / {totalBadges} badges
            </span>
            <Link to="/ludus"><Button variant="ghost" size="sm">Back to Ludus</Button></Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <p className="font-serif text-sm italic text-muted-foreground">
          Every honor your ludus has earned — five tiers each, the last a proper grind.
        </p>
        {isLoading && <p className="font-serif italic text-muted-foreground">Consulting the ludus's chronicles…</p>}
        {ACHIEVEMENTS.map(cat => (
          <AchievementCard key={cat.key} category={cat} value={progress[cat.key] ?? 0} />
        ))}
      </main>
    </div>
  );
}

function AchievementCard({ category, value }: { category: AchievementCategory; value: number }) {
  const highestUnlocked = category.tiers.filter(t => value >= t).length; // 0-5
  const nextTier = highestUnlocked < 5 ? category.tiers[highestUnlocked] : null;
  const prevTier = highestUnlocked > 0 ? category.tiers[highestUnlocked - 1] : 0;
  const pct = nextTier ? Math.min(100, ((value - prevTier) / (nextTier - prevTier)) * 100) : 100;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-lg text-primary">{category.label}</div>
          <p className="font-serif text-sm italic text-muted-foreground">{category.description}</p>
        </div>
        <div className="whitespace-nowrap text-right font-mono text-sm text-muted-foreground">
          {value.toLocaleString()}{nextTier ? ` / ${nextTier.toLocaleString()}` : " · maxed"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {category.tiers.map((t, i) => {
          const unlocked = value >= t;
          return (
            <div key={t} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition ${
                  unlocked
                    ? "border-primary bg-primary/15 text-primary shadow-[0_0_10px_rgba(0,0,0,0.15)]"
                    : "border-border bg-muted/40 text-muted-foreground"
                } ${i === 4 ? "ring-1 ring-accent/50" : ""}`}
                title={`Tier ${i + 1} — ${t.toLocaleString()}`}
              >
                {unlocked ? <Medal className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] font-mono ${unlocked ? "text-primary" : "text-muted-foreground"}`}>
                {t.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {nextTier && (
        <div className="mt-3">
          <Progress value={pct} className="h-1.5" />
        </div>
      )}
    </Card>
  );
}
