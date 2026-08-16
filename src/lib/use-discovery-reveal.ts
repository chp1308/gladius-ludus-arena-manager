import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DISCOVERY_INTRO, type DiscoveryKey } from "@/lib/discovery";

// Detects discoveries newly present in `discoveredKeys` since the last time
// this browser saw them (localStorage, namespaced per account) — toasts
// each one once and returns the set so the caller can apply a fade-in
// treatment to that building/tab. The localStorage key is shared across
// pages, so whichever page happens to observe a fresh discovery first is
// the one that toasts and animates it; any other page just sees it as
// already-seen and renders it in its normal steady state.
export function useDiscoveryReveal(
  profileId: string | undefined,
  discoveredKeys: string[] | undefined,
  labelFor: (key: DiscoveryKey) => string,
): Set<string> {
  const [justRevealed, setJustRevealed] = useState<Set<string>>(new Set());
  const keysSignature = (discoveredKeys ?? []).join(",");

  useEffect(() => {
    if (!profileId || !discoveredKeys) return;
    const storageKey = `gladius_seen_discoveries:${profileId}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); } catch { seen = []; }
    const seenSet = new Set(seen);
    const fresh = discoveredKeys.filter((k): k is DiscoveryKey => !seenSet.has(k) && k in DISCOVERY_INTRO);
    if (fresh.length === 0) return;
    for (const k of fresh) toast.success(`${labelFor(k)} unlocked!`);
    setJustRevealed(new Set(fresh));
    localStorage.setItem(storageKey, JSON.stringify([...seenSet, ...fresh]));
    // labelFor is expected stable enough per call site (inline function
    // recreated each render is fine — only keysSignature actually gates this).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, keysSignature]);

  return justRevealed;
}

// One extra in-fiction intro line the first time a given building/tab's
// dialog is opened, ever — separate from the map-reveal toast above, since
// a player can see something appear on the map well before they click in.
export function useFirstOpenIntro(profileId: string | undefined, key: DiscoveryKey | undefined): boolean {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (!profileId || !key || !(key in DISCOVERY_INTRO)) return;
    const storageKey = `gladius_intro_shown:${profileId}`;
    let shownList: string[] = [];
    try { shownList = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); } catch { shownList = []; }
    if (shownList.includes(key)) return;
    setShowIntro(true);
    localStorage.setItem(storageKey, JSON.stringify([...shownList, key]));
  }, [profileId, key]);

  return showIntro;
}
