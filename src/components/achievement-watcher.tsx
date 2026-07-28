import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Medal } from "lucide-react";
import { getAchievementProgress, ACHIEVEMENTS, type AchievementCategory } from "@/lib/game.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "gladius-ludus-seen-achievement-tiers";

function loadSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSeen(seen: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // localStorage unavailable (private browsing, etc.) — just skip persisting.
  }
}

function tierReached(category: AchievementCategory, value: number): number {
  let tier = 0;
  for (let i = 0; i < category.tiers.length; i++) {
    if (value >= category.tiers[i]) tier = i + 1;
  }
  return tier;
}

type Unlocked = { category: AchievementCategory; tier: number };

// Mounted once in the authenticated layout. Achievements have no dedicated
// DB table (purely derived from existing stats), so "newly earned" is
// detected client-side by diffing each category's current tier against the
// highest tier already celebrated, persisted in localStorage. On first-ever
// load for a browser, the current state is seeded silently so a veteran
// ludus doesn't get bombarded with popups for everything it already earned.
export function AchievementWatcher() {
  const fetchProgress = useServerFn(getAchievementProgress);
  const { data } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetchProgress({}),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const seededRef = useRef(false);
  const [queue, setQueue] = useState<Unlocked[]>([]);

  useEffect(() => {
    if (!data) return;
    const progress = data.progress;
    const seen = loadSeen();

    if (!seededRef.current && Object.keys(seen).length === 0) {
      const initial: Record<string, number> = {};
      for (const cat of ACHIEVEMENTS) initial[cat.key] = tierReached(cat, progress[cat.key] ?? 0);
      saveSeen(initial);
      seededRef.current = true;
      return;
    }
    seededRef.current = true;

    const newly: Unlocked[] = [];
    const updated = { ...seen };
    for (const cat of ACHIEVEMENTS) {
      const current = tierReached(cat, progress[cat.key] ?? 0);
      const prev = seen[cat.key] ?? 0;
      for (let t = prev + 1; t <= current; t++) newly.push({ category: cat, tier: t });
      updated[cat.key] = current;
    }
    if (newly.length > 0) {
      saveSeen(updated);
      setQueue((q) => [...q, ...newly]);
    }
  }, [data]);

  const current = queue[0];
  const dismiss = () => setQueue((q) => q.slice(1));
  if (!current) return null;

  const threshold = current.category.tiers[current.tier - 1];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="text-center sm:max-w-sm">
        <DialogHeader className="items-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/15 text-primary shadow-[0_0_20px_rgba(0,0,0,0.25)]">
            <Medal className="h-10 w-10" />
          </div>
          <DialogTitle className="mt-3 font-display text-xl text-primary">Achievement Unlocked!</DialogTitle>
          <DialogDescription className="font-serif italic">
            {current.category.label} — Tier {current.tier}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{current.category.description}</p>
        <p className="text-sm text-accent">Reached {threshold.toLocaleString()}. Congratulations!</p>
        <Button className="mt-2 w-full" onClick={dismiss}>Nice!</Button>
      </DialogContent>
    </Dialog>
  );
}
