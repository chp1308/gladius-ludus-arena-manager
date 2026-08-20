import { createFileRoute } from "@tanstack/react-router";
import { Swords, Shield, Heart, Zap, Brain, Dumbbell, Award, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { STAT_INFO, STAT_SCALING_NOTE } from "@/lib/stat-info";

const STAT_ICONS = { strength: Dumbbell, agility: Zap, stamina: Heart, technique: Brain } as const;

export const Route = createFileRoute("/_authenticated/info")({
  head: () => ({
    meta: [
      { title: "Combat Codex — Gladius Ludus" },
      { name: "description", content: "How stats, gear, level, weapon style and skills shape a gladiator's fighting power — and how Power differs from PvP Rating." },
    ],
  }),
  component: InfoPage,
});

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
        {icon} {title}
      </div>
      <div className="space-y-2 text-sm font-serif leading-relaxed text-muted-foreground">{children}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-1.5">
      <span className="text-foreground">{label}</span>
      <span className="italic">{value}</span>
    </div>
  );
}

const WEAPON_STYLES: { label: string; classes: string[]; shield: boolean; str: number; agi: number; sta: number; tec: number; favors: string }[] = [
  { label: "Gladius & Shield", classes: ["Murmillo", "Secutor", "Thraex"], shield: true, str: 4, agi: 2, sta: 4, tec: 2, favors: "Strength & Stamina" },
  { label: "Spear & Shield", classes: ["Hoplomachus"], shield: true, str: 2, agi: 3, sta: 3, tec: 4, favors: "Technique" },
  { label: "Net & Trident", classes: ["Retiarius"], shield: false, str: 2, agi: 4, sta: 2, tec: 4, favors: "Agility & Technique" },
  { label: "Dual Blades", classes: ["Dimachaerus"], shield: false, str: 3, agi: 5, sta: 2, tec: 2, favors: "Agility" },
];

function InfoPage() {
  return (
    <div className="min-h-screen">
      <AppHeader backTo="/ludus" maxWidth="max-w-5xl" title="Combat Codex" />

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className="p-6">
          <h1 className="font-display text-2xl text-primary">The Fighting Power</h1>
          <p className="mt-2 font-serif italic text-muted-foreground">
            Every duel is decided by <span className="text-foreground">Power</span> — the champion's raw might — and per-round <span className="text-foreground">Damage rolls</span> shaped by weapons, armor and grit.
          </p>
          <div className="mt-4 rounded-md border border-border/60 bg-background/60 p-4 font-mono text-xs text-foreground">
            Power = ( Weighted Stats + Gear + Level×6 ) × Health% × (1 + (Level−1)×2%) × (1 + Style×8%)
          </div>
          <p className="mt-2 text-xs italic text-muted-foreground">
            "Weighted Stats" isn't a flat sum — each weapon style leans on different stats. See <span className="text-foreground">Weapon Styles</span> below.
          </p>
        </Card>

        <Card className="p-6 border-accent/40">
          <div className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
            <Scale className="h-5 w-5" /> Power vs. Rating — not the same number
          </div>
          <div className="space-y-2 text-sm font-serif leading-relaxed text-muted-foreground">
            <p>
              You'll see two different scores for the same gladiator. They measure different things on purpose.
            </p>
            <p>
              <span className="text-foreground">Power</span> — shown on a gladiator's sheet and in fight logs — is how strong they are <span className="italic">right now</span>. It's weighted by weapon style, counts gear heavily, includes Study of Arms training, and drops when a gladiator is wounded. This is what actually decides win chance in a fight.
            </p>
            <p>
              <span className="text-foreground">Rating</span> — shown when posting or accepting PvP challenges — only exists to keep matchmaking fair. It's a flatter snapshot of overall investment (level, raw stats, gear), the same regardless of weapon style, current wounds, or skill training.
            </p>
            <div className="mt-2 rounded-md border border-border/60 bg-background/60 p-4 font-mono text-xs text-foreground">
              Rating = Level×10 + (STR+AGI+STA+TEC) + Weapon×2 + Armor×2 + Helmet + Greaves + Off-hand
            </div>
            <p>
              A challenger's and acceptor's Rating must sit within 25% of each other to fight — Rating exists so nobody can dodge a fair matchup by fielding a strong gladiator that "looks" weak. It never changes with injuries, and never reflects skill training.
            </p>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Level" icon={<Award className="h-5 w-5" />}>
            <p>Experience is the veteran's edge. Every level adds to your gladiator on three fronts:</p>
            <Row label="Flat Power bonus" value="+6 per level" />
            <Row label="Multiplier" value="+2% Power per level above 1" />
            <Row label="Hit damage" value="+1 min & max per level above 1" />
            <p>A high-level champion strikes harder than the same fighter at level 1 — even with identical stats and gear.</p>
          </Section>

          <Section title="Weapons" icon={<Swords className="h-5 w-5" />}>
            <p>The weapon tier sets the damage window of every strike, from rough iron to gilded mastercraft.</p>
            <Row label="Tier I (Iron)" value="15–30 dmg" />
            <Row label="Tier X (Bronze)" value="25–47 dmg" />
            <Row label="Tier XX (Gold)" value="36–65 dmg" />
            <p>Weapon tier also contributes +12 Power per tier. Higher tiers are gated by your Forge (Armory) level.</p>
          </Section>

          <Section title="Armor" icon={<Shield className="h-5 w-5" />}>
            <p>Armor reduces incoming damage. Each hit subtracts a mitigation roll from the enemy's weapon damage.</p>
            <Row label="Cuirass (body)" value="mitigation ×1.5" />
            <Row label="Helmet" value="mitigation ×1.0" />
            <Row label="Greaves (legs)" value="mitigation ×1.0" />
            <Row label="Off-hand — shield styles" value="mitigation ×0.8" />
            <Row label="Off-hand — Net & Trident / Dual Blades" value="damage bonus instead (no shield to mitigate with)" />
            <p>Each piece also feeds Power directly: Cuirass +9, Helmet +4, Greaves +4, Off-hand +5 per tier, regardless of style. The <span className="text-foreground">Defensive Doctrine</span> skill (Study of Arms) further hardens overall mitigation by +15% per rank.</p>
          </Section>

          <Section title="Gladiator Types & Weapon Styles" icon={<Scale className="h-5 w-5" />}>
            <p>
              A recruit's <span className="text-foreground">class</span> is their historical gladiator type — flavor text, but always matched to how they actually fight. Their <span className="text-foreground">weapon style</span> is what decides how much each stat point is worth in Power, and whether their off-hand slot carries a shield or a second weapon.
            </p>
            <div className="space-y-2">
              {WEAPON_STYLES.map((w) => (
                <div key={w.label} className="border-b border-border/40 py-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">{w.label} <span className="text-muted-foreground">— {w.classes.join(", ")}</span></span>
                    <span className="italic">STR×{w.str} AGI×{w.agi} STA×{w.sta} TEC×{w.tec} — favors {w.favors}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {w.shield
                      ? "Carries a shield — off-hand slot mitigates damage, and must block (not dodge) a boss's charge."
                      : "No shield — off-hand slot adds damage instead, and must dodge (not block) a boss's charge."}
                  </p>
                </div>
              ))}
            </div>
            <p>Beasts have their own weightings too — lions and tigers lean Strength/Agility, rhinos and elephants lean pure Strength and Stamina.</p>
          </Section>

          {STAT_INFO.map((s) => {
            const Icon = STAT_ICONS[s.key];
            return (
              <Section key={s.key} title={s.label} icon={<Icon className="h-5 w-5" />}>
                <p>{s.blurb}</p>
                {s.bonuses.map((b) => <Row key={b.label} label={b.label} value={b.value} />)}
                {s.key === "strength" && (
                  <>
                    <div className="rounded-md bg-background/60 p-3 font-mono text-xs text-foreground">Max HP = 100 + Strength × 5</div>
                    <p>Wounded gladiators fight at reduced Power (Health % applies) — keep your champions healed, or let the Valetudinarium's passive regeneration do its work.</p>
                  </>
                )}
              </Section>
            );
          })}

          <Section title="Skills & Style Mastery" icon={<Award className="h-5 w-5" />}>
            <p>Trained at the Study of Arms:</p>
            <Row label="Style mastery (Gladius, Spear, etc.)" value="+8% Power per rank" />
            <Row label="Defensive Doctrine" value="+15% armor mitigation per rank" />
            <p>A gladiator only benefits from the style matching their own weapon.</p>
          </Section>

          <Section title="Round Combat" icon={<Swords className="h-5 w-5" />}>
            <p>Each round a fighter's chance to land the hit is:</p>
            <div className="rounded-md bg-background/60 p-3 font-mono text-xs text-foreground">WinChance = 5% + 90% × (Power^0.75 / (Power^0.75 + EnemyPower^0.75))</div>
            <p>This gives a 5% minimum upset chance and a 95% maximum dominance chance. The winner then rolls damage from their weapon tier + level bonus, minus the target's armor mitigation.</p>
            <p>Pit fights and standard PvP never kill — the loser is left at 1 HP. Only <span className="text-foreground">Sine Missione</span> death matches can end in the loser being lost forever.</p>
          </Section>
        </div>

        <p className="text-center text-xs italic text-muted-foreground">{STAT_SCALING_NOTE}</p>
      </main>
    </div>
  );
}
