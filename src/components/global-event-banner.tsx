import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getGlobalEventState } from "@/lib/game.functions";
import { formatMinutes, minutesUntil } from "@/lib/format";
import porphyrionSelectImg from "@/assets/events/event-select.jpg";

// Mounted once in the authenticated layout, alongside AchievementWatcher.
// Polls for a global event and shows a slim banner while one is
// announced or live — nothing rendered otherwise. Clicking through lands
// on the Fights page's World Event tab (src/routes/_authenticated/arena.tsx),
// which is where actual participation happens.
export function GlobalEventBanner() {
  const fetchState = useServerFn(getGlobalEventState);
  const { data } = useQuery({
    queryKey: ["global-event"],
    queryFn: () => fetchState({}),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  // Only used to force a re-render once a minute so the countdown text
  // stays fresh between polls, without needing per-second precision here.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const event = data?.event;
  if (!event) return null;

  const label = event.status === "announced"
    ? `Porphyrion, King of the Giants, breaks through the gates of the underworld in ${formatMinutes(minutesUntil(event.starts_at))} — rally your gladiators.`
    : event.status === "live"
    ? "Porphyrion has broken through — Rome fights now. Answer the call!"
    : "Rome has held against Porphyrion. See how your ludus fared.";

  return (
    <Link
      to="/arena"
      search={{ tab: "event" }}
      className="flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-sm text-primary-foreground transition hover:opacity-90"
    >
      <img src={porphyrionSelectImg} alt="Porphyrion" className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-primary-foreground/50" />
      <span className="font-serif italic">{label}</span>
    </Link>
  );
}
