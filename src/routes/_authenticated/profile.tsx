import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ScrollText, Eye, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getMyLudusRoster, updateLudusProfile, WEAPON_LABELS } from "@/lib/game.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Public Profile — Gladius Ludus" },
      { name: "description", content: "Edit how your ludus appears to visitors: motto, biography and showcased gladiators." },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const fetchMine = useServerFn(getMyLudusRoster);
  const save = useServerFn(updateLudusProfile);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-ludus-roster"],
    queryFn: () => fetchMine({}),
  });

  const [motto, setMotto] = useState("");
  const [bio, setBio] = useState("");
  const [limit, setLimit] = useState(8);
  const [picks, setPicks] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile as unknown as {
      description: string | null; bio: string | null;
      showcase_limit: number | null; showcase_gladiator_ids: string[] | null;
    };
    setMotto(p.description ?? "");
    setBio(p.bio ?? "");
    setLimit(p.showcase_limit ?? 8);
    setPicks(p.showcase_gladiator_ids ?? []);
  }, [data?.profile]);

  const mut = useMutation({
    mutationFn: () => save({ data: {
      description: motto, bio,
      showcase_limit: limit,
      showcase_gladiator_ids: picks,
    } }),
    onSuccess: () => {
      toast.success("Public profile updated.");
      qc.invalidateQueries({ queryKey: ["my-ludus-roster"] });
      qc.invalidateQueries({ queryKey: ["ludus-state"] });
      if (data?.profile?.id) qc.invalidateQueries({ queryKey: ["public-ludus", data.profile.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePick = (id: string) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= limit) {
        toast.error(`You can only feature ${limit} gladiators. Raise the limit first.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const roster = data?.roster ?? [];
  const autoMode = picks.length === 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/ludus" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2 font-display text-xl tracking-widest text-primary">
              <ScrollText className="h-5 w-5" /> Public Profile
            </div>
          </div>
          {data?.profile?.id && (
            <Link to="/ludi/$id" params={{ id: data.profile.id }}>
              <Button variant="outline" size="sm"><Eye className="mr-1 h-4 w-4" /> Preview visitor view</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8">
        {isLoading && <p className="text-sm text-muted-foreground">Fetching your tablets…</p>}

        {data && (
          <>
            <Card className="p-6">
              <h2 className="mb-3 font-display text-lg tracking-widest text-primary">Motto</h2>
              <p className="mb-2 text-xs text-muted-foreground">A short creed shown at the top of your ludus page. Up to 500 characters.</p>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-border/60 bg-background p-3 font-serif italic text-sm outline-none focus:border-primary"
                maxLength={500}
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="Blood, honor, denarii — carve your ludus's creed…"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{motto.length}/500</div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-3 font-display text-lg tracking-widest text-primary">About the Lanista</h2>
              <p className="mb-2 text-xs text-muted-foreground">Tell rival ludi about yourself — history, playstyle, alliances. Up to 1500 characters.</p>
              <textarea
                className="min-h-[180px] w-full rounded-md border border-border/60 bg-background p-3 font-serif text-sm outline-none focus:border-primary"
                maxLength={1500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="I hail from Capua, third-generation lanista, favoring heavy shields and slow blades…"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/1500</div>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg tracking-widest text-primary">Showcased Gladiators</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <label htmlFor="limit">Show up to</label>
                  <input
                    id="limit"
                    type="number"
                    min={1}
                    max={12}
                    value={limit}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                      setLimit(v);
                      if (picks.length > v) setPicks(picks.slice(0, v));
                    }}
                    className="w-16 rounded-md border border-border/60 bg-background px-2 py-1 text-center font-mono text-sm"
                  />
                  <span>fighters</span>
                </div>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {autoMode
                  ? `Automatic: showing your top ${limit} by wins. Click gladiators below to hand-pick which to feature.`
                  : `Featuring ${picks.length}/${limit} hand-picked. Click again to remove — clear all to return to automatic.`}
              </p>

              {roster.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">No living gladiators to showcase.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {roster.map((g) => {
                    const selected = picks.includes(g.id);
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => togglePick(g.id)}
                        className={`flex items-center justify-between rounded-md border p-3 text-left text-sm transition ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border/50 bg-background/60 hover:border-primary/60"
                        }`}
                      >
                        <div>
                          <div className="font-serif text-foreground">{g.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Lv {g.level} · {g.is_beast ? WEAPON_LABELS[g.weapon_type] ?? g.class : `${g.class} · ${WEAPON_LABELS[g.weapon_type] ?? g.weapon_type}`}
                          </div>
                        </div>
                        <Badge variant={selected ? "default" : "secondary"} className="font-mono">
                          {g.wins}W/{g.losses}L
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
              {picks.length > 0 && (
                <div className="mt-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setPicks([])}>Clear selection (auto pick)</Button>
                </div>
              )}
            </Card>

            <div className="flex justify-end">
              <Button size="lg" disabled={mut.isPending} onClick={() => mut.mutate()}>
                <Save className="mr-2 h-4 w-4" /> {mut.isPending ? "Saving…" : "Save public profile"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
