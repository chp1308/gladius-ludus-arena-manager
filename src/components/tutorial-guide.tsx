import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Compass } from "lucide-react";
import { getLudusState, advanceTutorial, markBuildingVisited } from "@/lib/game.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Scripted first-time-user tutorial. Mounted once in the authenticated
// layout so it works regardless of which page the player is currently on —
// it watches the same ["ludus"] query every page already shares, so a step
// change from any action (recruiting, fighting, visiting a building) is
// picked up reactively without per-page wiring. Steps with a gameplay
// mechanic or a "go visit X" requirement advance themselves elsewhere
// (recruit/fight/train handlers, markBuildingVisited); the two pure-
// information steps here ("unlocks", "codex") advance via advanceTutorial.
type TutorialStep =
  | "welcome" | "cursus_or_fight" | "unlocks"
  | "visit_cursus" | "visit_ludus"
  | "codex" | "training" | "recruit_second" | "done";

const UNLOCK_SUMMARY: { name: string; blurb: string }[] = [
  { name: "Valetudinarium", blurb: "Faster healing, shorter injuries." },
  { name: "Chronicle Stele", blurb: "Every match, carved in stone." },
  { name: "Rival Ludi (Fights tab)", blurb: "Challenge other players' champions to earn fame and glory." },
  { name: "The Forge", blurb: "Unlock higher tiers of gear." },
];

function hasOpenDialog(): boolean {
  return document.querySelectorAll('[role="dialog"]').length > 0;
}

// Waits until no other dialog (a fight's own battle animation/result,
// a confirm prompt, etc.) is open before allowing a tutorial dialog for
// `step` to render — otherwise e.g. "unlocks" can pop up on top of the
// fight's own result dialog the instant the underlying query refetches.
// Re-checks fresh every time `step` changes to a new value.
function useReadyToShow(step: TutorialStep): boolean {
  const [readyFor, setReadyFor] = useState<TutorialStep | null>(null);
  useEffect(() => {
    if (step === "done" || readyFor === step) return;
    if (!hasOpenDialog()) { setReadyFor(step); return; }
    const id = setInterval(() => {
      if (!hasOpenDialog()) { setReadyFor(step); clearInterval(id); }
    }, 400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  return readyFor === step;
}

export function TutorialGuide() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const fetchState = useServerFn(getLudusState);
  const { data } = useQuery({
    queryKey: ["ludus"],
    queryFn: () => fetchState(),
    refetchInterval: 20_000,
  });
  const step = (data?.profile?.tutorial_step ?? "done") as TutorialStep;
  const ready = useReadyToShow(step);

  // "welcome"/"cursus_or_fight"/"visit_cursus"/"visit_ludus"/"training" have
  // no dismiss-driven server transition (the guided action itself advances
  // them) — track locally so clicking through doesn't just reopen the same
  // dialog immediately, while still reappearing if the player reloads
  // without having taken that action.
  const [dismissed, setDismissed] = useState<TutorialStep | null>(null);
  const closeLocally = () => setDismissed(step);

  const advance = useServerFn(advanceTutorial);
  const advanceMut = useMutation({
    mutationFn: (vars: { from: "unlocks" | "codex" }) => advance({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ludus"] }),
  });

  // "codex" only advances to "training" once the player has actually
  // navigated away from the Codex page — not the instant they click
  // through to it, so they get a real look first. "Has been to /info
  // during this step" has to survive a hard reload/back-button (not just
  // a client-side route change), so it's persisted server-side via the
  // same visited_buildings array markBuildingVisited already maintains,
  // rather than a client-only ref.
  const markVisited = useServerFn(markBuildingVisited);
  const hasVisitedCodexPage = !!data?.profile?.visited_buildings?.includes("codex");
  useEffect(() => {
    if (step !== "codex") return;
    if (location.pathname === "/info") {
      if (!hasVisitedCodexPage) markVisited({ data: { key: "codex" } }).then(() => qc.invalidateQueries({ queryKey: ["ludus"] }));
      return;
    }
    if (hasVisitedCodexPage) advanceMut.mutate({ from: "codex" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, location.pathname, hasVisitedCodexPage]);

  if (!ready || step === "done" || step === dismissed) return null;

  if (step === "welcome") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) closeLocally(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> Welcome, Lanista!
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-sm text-muted-foreground">
            Rome has granted you a plot of land and a handful of denarii — the rest is up to you.
            Recruit gladiators, train them, and send them to fight for glory and gold. Every great ludus starts with a single fighter.
          </p>
          <p className="font-serif text-sm italic text-accent">Visit the Slave Market to recruit your first gladiator.</p>
          <Button className="w-full" onClick={closeLocally}>Let's begin!</Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "cursus_or_fight") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) closeLocally(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> Your first gladiator has arrived!
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-sm text-muted-foreground">
            Two paths lie open to you. Send your gladiator on a <strong>Cursus Honorum</strong> errand —
            a social gambit at Rome's high society that can win coin, fame, or the odd bruised ego, with a
            cooldown between outings. Or take them straight to the <strong>Pits</strong> to fight for denarii and glory.
            Do either, or both, whenever you're ready.
          </p>
          <Button
            className="w-full"
            onClick={() => { closeLocally(); navigate({ to: "/arena" }); }}
          >
            Take me to the Fights
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "unlocks") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) advanceMut.mutate({ from: "unlocks" }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> Victory! New paths have opened.
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {UNLOCK_SUMMARY.map((u) => (
              <li key={u.name} className="font-serif text-sm">
                <span className="text-accent">{u.name}</span> — <span className="text-muted-foreground">{u.blurb}</span>
              </li>
            ))}
          </ul>
          <Button
            className="w-full"
            disabled={advanceMut.isPending}
            onClick={() => advanceMut.mutate({ from: "unlocks" })}
          >
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "visit_cursus") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) closeLocally(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> Time to try the Cursus Honorum
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-sm text-muted-foreground">
            Your gladiator has proven themselves in the pits — now see what Rome's high society has to
            offer. Send them on a Cursus Honorum errand for a shot at coin or fame. Your very first outing
            is guaranteed to go well, so there's nothing to lose.
          </p>
          <Button
            className="w-full"
            onClick={() => { closeLocally(); navigate({ to: "/ludus" }); }}
          >
            Take me there
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "visit_ludus") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) closeLocally(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> Check in on your ludus
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-sm text-muted-foreground">
            Take a look at Ludus Grounds — this is where you'll always find your full roster, their
            health, and how they're growing. Worth a visit any time you want to see how your gladiators are doing.
          </p>
          <Button
            className="w-full"
            onClick={() => { closeLocally(); navigate({ to: "/ludus" }); }}
          >
            Take me there
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "codex") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) closeLocally(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> One more thing — the Codex
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-sm text-muted-foreground">
            The Combat Codex holds everything you need to know: what each stat does, how weapon styles
            compare, arena tiers, and the mechanics behind healing, injuries, and gear. Worth a look
            whenever you're unsure of a number.
          </p>
          <Button
            className="w-full"
            onClick={() => { closeLocally(); navigate({ to: "/info" }); }}
          >
            Open the Codex
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "training") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) closeLocally(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> Last lesson: the Training Yard
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-sm text-muted-foreground">
            Every gladiator can be trained — pick one stat to raise: Strength, Agility, Stamina, or Technique.
            Your first session is on the house. Choose wisely; each session afterward will cost denarii.
          </p>
          <Button
            className="w-full"
            onClick={() => { closeLocally(); navigate({ to: "/ludus" }); }}
          >
            Take me to the Training Yard
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "recruit_second") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) closeLocally(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
              <Compass className="h-5 w-5" /> A single fighter is a start, not a ludus
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-sm text-muted-foreground">
            One gladiator can only carry you so far. Head back to the Slave Market and recruit a second —
            a bigger roster opens up Team Battles, the Study of Arms, and more room in your Pantry.
          </p>
          <Button
            className="w-full"
            onClick={() => { closeLocally(); navigate({ to: "/ludus" }); }}
          >
            Take me to the Slave Market
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
