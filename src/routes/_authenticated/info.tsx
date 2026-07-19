import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Swords, Shield, Heart, Zap, Brain, Dumbbell, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/info")({
  head: () => ({
    meta: [
      { title: "Combat Codex — Gladius Ludus" },
      { name: "description", content: "How stats, gear, level and skills shape a gladiator's fighting power." },
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

function InfoPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/ludus" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="font-display text-xl tracking-widest text-primary">Combat Codex</div>
          </div>
          <Link to="/ludus"><Button variant="ghost" size="sm">Back to Ludus</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className="p-6">
          <h1 className="font-display text-2xl text-primary">The Fighting Power</h1>
          <p className="mt-2 font-serif italic text-muted-foreground">
            Every duel is decided by <span className="text-foreground">Power</span> — the champion's raw might — and per-round <span className="text-foreground">Damage rolls</span> shaped by weapons, armor and grit.
          </p>
          <div className="mt-4 rounded-md border border-border/60 bg-background/60 p-4 font-mono text-xs text-foreground">
            Power = ( 3 × (STR + AGI + STA + TEC) + Gear + Level×14 ) × Health% × (1 + (Level−1)×6%) × (1 + Style×8%)
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Level" icon={<Award className="h-5 w-5" />}>
            <p>Experience is the veteran's edge. Every level adds to your gladiator on three fronts:</p>
            <Row label="Flat Power bonus" value="+14 per level" />
            <Row label="Multiplier" value="+6% Power per level above 1" />
            <Row label="Hit damage" value="+2 min & max per level above 1" />
            <p>A level 10 champion strikes noticeably harder than the same fighter at level 1 — even with identical stats and gear.</p>
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
            <Row label="Cuirass (body)" value="weight ×1.5" />
            <Row label="Helmet" value="weight ×1.0" />
            <Row label="Greaves (legs)" value="weight ×1.0" />
            <Row label="Off-hand / Shield" value="weight ×0.8" />
            <p>Higher tiers absorb more. The <span className="text-foreground">Defensive Doctrine</span> skill (Study of Arms) further hardens armor by +15% per rank.</p>
          </Section>

          <Section title="Strength" icon={<Dumbbell className="h-5 w-5" />}>
            <p>Raw muscle. Contributes +3 Power per point via the core stat pool.</p>
            <p className="italic">Best for: Murmillo, Secutor, Dimachaerus — brawlers who trade blows.</p>
          </Section>

          <Section title="Agility" icon={<Zap className="h-5 w-5" />}>
            <p>Speed and footwork. +3 Power per point. Nimble fighters win more round exchanges via the initiative roll.</p>
            <p className="italic">Best for: Retiarius, Dimachaerus — hit-and-retreat styles.</p>
          </Section>

          <Section title="Stamina" icon={<Heart className="h-5 w-5" />}>
            <p>Endurance and constitution. +3 Power per point AND +5 maximum Health per point.</p>
            <div className="rounded-md bg-background/60 p-3 font-mono text-xs text-foreground">Max HP = 100 + Stamina × 5</div>
            <p>Wounded gladiators fight at reduced Power (Health % applies). Keep your champions healed.</p>
          </Section>

          <Section title="Technique" icon={<Brain className="h-5 w-5" />}>
            <p>Skill of arms. +3 Power per point. Rewards fighters with clean, disciplined technique.</p>
            <p className="italic">Best for: any class — but Provocator and Hoplomachus benefit most.</p>
          </Section>

          <Section title="Skills & Style Mastery" icon={<Award className="h-5 w-5" />}>
            <p>Trained at the Study of Arms:</p>
            <Row label="Style mastery (Gladius, Spear, etc.)" value="+8% Power per rank" />
            <Row label="Defensive Doctrine" value="+15% armor mitigation per rank" />
            <p>A gladiator only benefits from the style matching their weapon.</p>
          </Section>

          <Section title="Round Combat" icon={<Swords className="h-5 w-5" />}>
            <p>Each round both fighters roll <span className="text-foreground">Power + 0–40</span>. Highest roll lands a hit; damage is then rolled from their weapon tier + level bonus, minus the target's armor mitigation.</p>
            <p>First fighter to 0 HP loses. In <span className="text-foreground">Sine Missione</span> death matches, the loser is lost forever.</p>
          </Section>
        </div>
      </main>
    </div>
  );
}
