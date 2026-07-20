import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Crown, Shield, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicLudus, WEAPON_LABELS } from "@/lib/game.functions";

export const Route = createFileRoute("/_authenticated/ludi/$id")({
  head: () => ({
    meta: [
      { title: "Visit Ludus — Gladius Ludus" },
      { name: "description", content: "Visit a rival ludus, inspect their showcased gladiators and their honors." },
    ],
  }),
  component: VisitLudusPage,
});

function VisitLudusPage() {
  const { id } = Route.useParams();
  const fetchLudus = useServerFn(getPublicLudus);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-ludus", id],
    queryFn: () => fetchLudus({ data: { id } }),
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/leaderboard" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2 font-display text-xl tracking-widest text-primary">
              <Shield className="h-5 w-5" /> Visiting Ludus
            </div>
          </div>
          <Link to="/leaderboard"><Button variant="ghost" size="sm">Hall of Champions</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {isLoading && <p className="text-sm text-muted-foreground">The gates creak open…</p>}
        {error && <p className="text-sm text-destructive">This ludus could not be found.</p>}

        {data && (
          <>
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl tracking-widest text-primary">{data.profile.ludus_name}</h1>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    Founded {new Date(data.profile.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    <Crown className="mr-1 h-3 w-3" /> {data.profile.reputation} fame
                  </Badge>
                  {data.profile.best_rank && (
                    <Badge variant="outline" className="font-mono">
                      <Trophy className="mr-1 h-3 w-3" /> Best rank #{data.profile.best_rank}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-md border border-border/50 bg-secondary/30 p-4">
                {data.profile.description?.trim() ? (
                  <p className="whitespace-pre-wrap font-serif italic text-foreground/90">
                    “{data.profile.description}”
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    The lanista has left no words on the tablets.
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <FacilityStat label="Training" level={data.profile.training_level} />
                <FacilityStat label="Scouting" level={data.profile.scouting_level} />
                <FacilityStat label="Valetudinarium" level={data.profile.medicus_level} />
                <FacilityStat label="Forge" level={data.profile.armory_level} />
                <FacilityStat label="Pantry" level={data.profile.pantry_level} />
              </div>

              {data.profile.bio?.trim() && (
                <div className="mt-4 rounded-md border border-border/40 bg-background/40 p-4">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">About the Lanista</div>
                  <p className="whitespace-pre-wrap font-serif text-sm text-foreground/90">{data.profile.bio}</p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <FacilityStat label="Training" level={data.profile.training_level} />
                <FacilityStat label="Scouting" level={data.profile.scouting_level} />
                <FacilityStat label="Valetudinarium" level={data.profile.medicus_level} />
                <FacilityStat label="Forge" level={data.profile.armory_level} />
                <FacilityStat label="Pantry" level={data.profile.pantry_level} />
              </div>
            </Card>

            <div className="mt-6">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg tracking-widest text-primary">Showcased Fighters</h2>
                <span className="text-xs text-muted-foreground">
                  {data.showcase.length} shown · {data.roster_count} total in this ludus
                </span>
              </div>

              {data.showcase.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">No gladiators walk this ludus's sands.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.showcase.map((g) => {
                    const power = g.strength + g.agility + g.stamina + g.technique;
                    return (
                      <Card key={g.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-serif text-lg text-foreground">{g.name}</div>
                            <div className="text-xs italic text-muted-foreground">of {g.origin}</div>
                          </div>
                          <Badge className="bg-accent text-accent-foreground">Lv {g.level}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary">
                            {g.is_beast ? WEAPON_LABELS[g.weapon_type] ?? g.class
                              : `${g.class} · ${WEAPON_LABELS[g.weapon_type] ?? g.weapon_type}`}
                          </Badge>
                          <span className="text-muted-foreground">{g.wins}W / {g.losses}L</span>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Stat label="STR" v={g.strength} />
                          <Stat label="AGI" v={g.agility} />
                          <Stat label="STA" v={g.stamina} />
                          <Stat label="TEC" v={g.technique} />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Power {power}</span>
                          {g.best_rank ? (
                            <span className="flex items-center gap-1 text-primary">
                              <Trophy className="h-3 w-3" /> Best #{g.best_rank}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Unranked</span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function FacilityStat({ label, level }: { label: string; level: number }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/50 p-2 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-primary">Lv {level}</div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded border border-border/40 bg-background/60 p-1">
      <div>{label}</div>
      <div className="font-mono text-sm text-foreground">{v}</div>
    </div>
  );
}
