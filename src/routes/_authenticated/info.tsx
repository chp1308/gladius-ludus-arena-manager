import { createFileRoute } from "@tanstack/react-router";
import { Swords, Shield, Heart, Zap, Brain, Dumbbell, Award, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";

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

const WEAPON_STYLES: { label: string; str: number; agi: number; sta: number; tec: number; favors: string }[] = [
  { label: "Gladius & Shield", str: 4, agi: 2, sta: 4, tec: 2, favors: "Strength & Stamina" },
  { label: "Spear", str: 2, agi: 3, sta: 3, tec: 4, favors: "Technique" },
  { label: "Net & Trident", str: 2, agi: 4, sta: 2, tec: 4, favors: "Agility & Technique" },
  { label: "Dual Blades", str: 3, agi: 5, sta: 2, tec: 2, favors: "Agility" },
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
            <Row label="Tier IV (Bronze)" value="24–45 dmg" />
            <Row label="Tier VIII (Gold)" value="36–65 dmg" />
            <p>Weapon tier also contributes +12 Power per tier. Higher tiers are gated by your Forge (Armory) level.</p>
          </Section>

          <Section title="Armor" icon={<Shield className="h-5 w-5" />}>
            <p>Armor reduces incoming damage. Each hit subtracts a mitigation roll from the enemy's weapon damage.</p>
            <Row label="Cuirass (body)" value="mitigation ×1.5" />
            <Row label="Helmet" value="mitigation ×1.0" />
            <Row label="Greaves (legs)" value="mitigation ×1.0" />
            <Row label="Off-hand / Shield" value="mitigation ×0.8" />
            <p>Each piece also feeds Power directly: Cuirass +9, Helmet +4, Greaves +4, Off-hand +5 per tier. The <span className="text-foreground">Defensive Doctrine</span> skill (Study of Arms) further hardens mitigation by +15% per rank.</p>
          </Section>

          <Section title="Weapon Styles" icon={<Scale className="h-5 w-5" />}>
            <p>
              Your gladiator's <span className="text-foreground">weapon style</span> (not their class name — class is flavor only) decides how much each stat point is worth in Power.
            </p>
            <div className="space-y-1.5">
              {WEAPON_STYLES.map((w) => (
                <div key={w.label} className="flex items-center justify-between border-b border-border/40 py-1.5 text-xs">
                  <span className="text-foreground">{w.label}</span>
                  <span className="italic">STR×{w.str} AGI×{w.agi} STA×{w.sta} TEC×{w.tec} — favors {w.favors}</span>
                </div>
              ))}
            </div>
            <p>Beasts have their own weightings too — lions and tigers lean Strength/Agility, rhinos and elephants lean pure Strength and Stamina.</p>
          </Section>

          <Section title="Strength" icon={<Dumbbell className="h-5 w-5" />}>
            <p>Raw muscle. Weighted per weapon style (see Weapon Styles) — worth the most to Gladius & Shield fighters — AND separately sets maximum Health.</p>
            <div className="rounded-md bg-background/60 p-3 font-mono text-xs text-foreground">Max HP = 100 + Strength × 5</div>
            <p>Wounded gladiators fight at reduced Power (Health % applies) — keep your champions healed, or let the Valetudinarium's passive regeneration do its work.</p>
          </Section>

          <Section title="Agility" icon={<Zap className="h-5 w-5" />}>
            <p>Speed and footwork. Weighted per weapon style — Dual Blades leans on it hardest, followed by Net & Trident.</p>
          </Section>

          <Section title="Stamina" icon={<Heart className="h-5 w-5" />}>
            <p>Endurance and grit. Weighted per weapon style — heaviest for Gladius & Shield fighters, moderate for Spear and Dual Blades.</p>
          </Section>

          <Section title="Technique" icon={<Brain className="h-5 w-5" />}>
            <p>Skill of arms. Weighted per weapon style — Spear and Net & Trident fighters lean on it most.</p>
          </Section>

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
      </main>
    </div>
  );
}
