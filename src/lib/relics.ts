// RELICS — permanent, account-wide unlocks found as rare boss loot. Unlike
// gear (per-gladiator, re-rollable) these live on the ludus itself
// (profiles.relics) and apply everywhere, forever, once found. Displayed in
// the Temple of Relics building in the ludus.
import goldTrinketImg from "@/assets/relics/gold_trinket.png";
import titanShardImg from "@/assets/relics/titan_shard.png";

export type Relic = {
  key: string;
  label: string;
  description: string;
  // Optional so a relic can ship (and be granted) before its art exists —
  // see the Temple of Relics display, which falls back to a plain icon.
  image?: string;
  // Additive gold-gain bonus (0.075 = +7.5%), stacks with other relics.
  goldBonusPct?: number;
  // A second, larger bonus that only kicks in once the ludus has slain a
  // specific boss enough times — stacks on top of goldBonusPct.
  bonusTier?: {
    bossKey: string;
    killsRequired: number;
    extraGoldBonusPct: number;
    label: string;
  };
  // Relics that level up via repeated drops instead of being a one-time
  // owned/not-owned unlock — tier stored per-player in profiles.relic_tiers
  // (relic key -> current tier, 0 meaning not yet dropped). What each tier
  // actually does lives with whatever system reads it (e.g. global events'
  // max-fighters check), not here — this is just for display.
  maxTier?: number;
  tierDescription?: (tier: number) => string;
};

export const RELICS: Relic[] = [
  {
    key: "gold_trinket",
    label: "Tusk of the Great Boar",
    description: "A tusk of the Erymanthian Boar, plated in gold by a grateful goldsmith of Mycenae. Increases all denarii earned — from fights, events, everything — by 7.5%.",
    image: goldTrinketImg,
    goldBonusPct: 0.075,
    bonusTier: {
      bossKey: "erymanthian_boar",
      killsRequired: 25,
      extraGoldBonusPct: 0.025,
      label: "Having slain 25 boars, the tusk's gold inlay glows brighter — another +2.5% (10% total).",
    },
  },
  {
    key: "titan_shard",
    label: "Shard of the Titan's Chain",
    description: "A fragment of the chains that once bound Porphyrion, King of the Giants, torn loose when he broke free at the gates of the underworld. A 10% chance to recover one from each World Event you fight in — more than one champion of Rome can carry a shard. Each shard fields one more champion at the next World Event.",
    image: titanShardImg,
    maxTier: 5,
    tierDescription: (tier) => `Tier ${tier}/5 — fields up to ${1 + tier} champion${1 + tier === 1 ? "" : "s"} at a World Event.`,
  },
];

// Additive stacking: two +5% relics give +10%, not +10.25%.
export function goldMultiplier(relics: string[] | null | undefined, bossKills: Record<string, number> | null | undefined): number {
  const owned = relics ?? [];
  const kills = bossKills ?? {};
  let bonus = 0;
  for (const r of RELICS) {
    if (!owned.includes(r.key)) continue;
    bonus += r.goldBonusPct ?? 0;
    if (r.bonusTier && (kills[r.bonusTier.bossKey] ?? 0) >= r.bonusTier.killsRequired) {
      bonus += r.bonusTier.extraGoldBonusPct;
    }
  }
  return 1 + bonus;
}

// Only ever rounds UP gains, never penalties — callers must only apply this
// to positive amounts.
export function applyGoldBonus(
  amount: number,
  relics: string[] | null | undefined,
  bossKills: Record<string, number> | null | undefined,
): number {
  if (amount <= 0) return amount;
  return Math.round(amount * goldMultiplier(relics, bossKills));
}
