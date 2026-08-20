import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminLogin, adminLogout, adminSessionStatus, getAdminStats, adminSearchLudi, getAdminLudusDetail } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, ShieldCheck, Search, X } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Gladius Ludus" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(adminSessionStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin-session-status"],
    queryFn: () => fetchStatus(),
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center font-serif italic text-muted-foreground">Loading…</div>;
  }

  if (!status?.authenticated) {
    return <AdminLogin onLoggedIn={() => qc.invalidateQueries({ queryKey: ["admin-session-status"] })} />;
  }

  return <AdminDashboard onLoggedOut={() => qc.invalidateQueries({ queryKey: ["admin-session-status"] })} />;
}

function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const login = useServerFn(adminLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const mut = useMutation({
    mutationFn: () => login({ data: { username, password } }),
    onSuccess: onLoggedIn,
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="inscribed ornate-border rounded-lg p-8">
          <h1 className="flex items-center justify-center gap-2 text-center font-display text-2xl">
            <ShieldCheck className="h-6 w-6 text-primary" /> Admin
          </h1>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username">Name</Label>
              <Input id="admin-username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={mut.isPending}>
              {mut.isPending ? "..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl text-primary">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

// Formats a raw stat_level-style key ("training_level") into a display
// label ("Training") — every facility level on the profile follows this
// same "<key>_level" naming, so one formatter covers all of them.
function facilityLabel(key: string): string {
  return key.replace(/_level$/, "").replace(/^\w/, c => c.toUpperCase());
}

const PROFILE_FACILITY_KEYS = [
  "training_level", "scouting_level", "medicus_level",
  "armory_level", "pantry_level", "social_level", "relics_level",
] as const;

function LudusDetail({ ludusId, onClose }: { ludusId: string; onClose: () => void }) {
  const fetchDetail = useServerFn(getAdminLudusDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-ludus-detail", ludusId],
    queryFn: () => fetchDetail({ data: { ludusId } }),
  });

  return (
    <Card className="border-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="font-display text-lg">
          {data ? data.profile.ludus_name : "Ludus"}
          {data?.profile.is_bot && <Badge variant="secondary" className="ml-2 align-middle">Bot</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <p className="font-serif italic text-muted-foreground">Consulting the ledgers…</p>}
        {error && <p className="text-destructive">{(error as Error).message}</p>}
        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Denarii" value={data.profile.denarii.toLocaleString()} hint="Current purse" />
              <StatCard label="Reputation" value={data.profile.reputation.toLocaleString()} hint="Fame" />
              <StatCard label="Joined" value={new Date(data.profile.created_at).toLocaleDateString()} hint={new Date(data.profile.created_at).toLocaleTimeString()} />
              <StatCard label="Last active" value={new Date(data.profile.updated_at).toLocaleDateString()} hint={new Date(data.profile.updated_at).toLocaleTimeString()} />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-foreground">Facility levels</div>
              <div className="flex flex-wrap gap-2">
                {PROFILE_FACILITY_KEYS.map((key) => (
                  <Badge key={key} variant="outline">{facilityLabel(key)}: {data.profile[key]}</Badge>
                ))}
                <Badge variant="outline">Keys to the Underworld: {data.profile.hades_keys}</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Matches (last 50)" value={data.totals.matchCount.toLocaleString()} hint="Fetched window, not lifetime" />
              <StatCard
                label="Win rate"
                value={data.totals.matchCount > 0 ? `${Math.round((data.totals.winCount / data.totals.matchCount) * 100)}%` : "—"}
                hint={`${data.totals.winCount} of ${data.totals.matchCount}`}
              />
              <StatCard label="Gold earned" value={data.totals.totalGoldEarned.toLocaleString()} hint="Sum, last 50 matches" />
              <StatCard label="XP earned" value={data.totals.totalXpEarned.toLocaleString()} hint="Sum, last 50 matches" />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-foreground">Roster ({data.gladiators.length})</div>
              {data.gladiators.length === 0 ? (
                <p className="font-serif italic text-muted-foreground">No gladiators.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Style</th>
                        <th className="px-3 py-2 text-right">Lvl</th>
                        <th className="px-3 py-2 text-right">W/L</th>
                        <th className="px-3 py-2 text-right">STR/AGI/STA/TEC</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.gladiators.map((g) => (
                        <tr key={g.id} className="border-t border-border/60">
                          <td className="px-3 py-2">{g.name}{g.is_beast && <Badge variant="secondary" className="ml-1.5">Beast</Badge>}</td>
                          <td className="px-3 py-2 text-muted-foreground">{g.class}</td>
                          <td className="px-3 py-2 text-muted-foreground">{g.weapon_type}</td>
                          <td className="px-3 py-2 text-right">{g.level}</td>
                          <td className="px-3 py-2 text-right">{g.wins}/{g.losses}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{g.strength}/{g.agility}/{g.stamina}/{g.technique}</td>
                          <td className="px-3 py-2">
                            {g.status === "dead" ? <Badge variant="destructive">Dead</Badge> : <span className="text-muted-foreground">{g.status}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-foreground">Recent matches</div>
              {data.recentMatches.length === 0 ? (
                <p className="font-serif italic text-muted-foreground">No matches yet.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-xs">
                  {data.recentMatches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                      <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                      <span>{m.difficulty} vs {m.opponent_name}</span>
                      <span className={m.result === "win" ? "text-accent" : "text-destructive"}>{m.result}</span>
                      <span className="text-muted-foreground">+{m.denarii_gained}d · +{m.xp_gained}xp</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LudusLookup() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const search = useServerFn(adminSearchLudi);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-ludus-search", submittedQuery],
    queryFn: () => search({ data: { query: submittedQuery } }),
    enabled: submittedQuery.length > 0,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedId(null);
    setSubmittedQuery(query.trim());
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Ludus Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="flex gap-2">
            <Input
              placeholder="Search by ludus name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={!query.trim()}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </form>

          {isLoading && <p className="font-serif italic text-muted-foreground">Searching…</p>}
          {error && <p className="text-destructive">{(error as Error).message}</p>}
          {data && (
            data.results.length === 0 ? (
              <p className="font-serif italic text-muted-foreground">No ludus matches "{submittedQuery}".</p>
            ) : (
              <div className="divide-y divide-border/60 rounded-md border border-border">
                {data.results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 ${selectedId === r.id ? "bg-muted/60" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      {r.ludus_name}
                      {r.is_bot && <Badge variant="secondary">Bot</Badge>}
                    </span>
                    <span className="text-muted-foreground">{r.denarii.toLocaleString()}d · {r.reputation.toLocaleString()} fame</span>
                  </button>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {selectedId && <LudusDetail ludusId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function AdminDashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const fetchStats = useServerFn(getAdminStats);
  const logout = useServerFn(adminLogout);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
  });

  const logoutMut = useMutation({
    mutationFn: () => logout(),
    onSuccess: onLoggedOut,
  });

  const chartData = (data?.signupsByDay ?? []).map(d => ({ ...d, label: d.day.slice(5) }));

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="flex items-center gap-2 font-display text-xl text-primary">
            <ShieldCheck className="h-5 w-5" /> Admin Dashboard
          </h1>
          <Button variant="ghost" onClick={() => logoutMut.mutate()} disabled={logoutMut.isPending}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <LudusLookup />

        {isLoading && <p className="font-serif italic text-muted-foreground">Consulting the ledgers…</p>}
        {error && <p className="text-destructive">{(error as Error).message}</p>}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard
                label="Daily active players"
                value={data.dau.toLocaleString()}
                hint="Non-bot players with any profile-touching action today."
              />
              <StatCard
                label="Weekly active players"
                value={data.wau.toLocaleString()}
                hint="Same, trailing 7 days."
              />
              <StatCard
                label="Monthly active players"
                value={data.mau.toLocaleString()}
                hint="Same, trailing 30 days."
              />
              <StatCard
                label="7-day retention"
                value={data.retention7d ? `${Math.round(data.retention7d.retainedPct)}%` : "—"}
                hint={data.retention7d
                  ? `Of ${data.retention7d.cohortSize} players who joined 8-30 days ago, % active in the last 7 days.`
                  : "Not enough players 8-30 days old yet."}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Avg. gold / active player / day"
                value={Math.round(data.avgGoldPerActivePlayerPerDay).toLocaleString()}
                hint="Denarii from pit/team/PvP/boss fights and positive Cursus Honorum outcomes, per player-day active in the last 30 days."
              />
              <StatCard
                label="Avg. XP / active gladiator / day"
                value={Math.round(data.avgXpPerActiveGladiatorPerDay).toLocaleString()}
                hint="XP from fights, per gladiator-day active in the last 30 days."
              />
              <StatCard
                label="Avg. Cursus Honorum / active player / day"
                value={data.avgCursusHonorumTriggersPerActivePlayerPerDay.toFixed(2)}
                hint="Triggers per player-day, among players who used it at least once in the last 30 days."
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Daily signups — last 30 days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={2} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={30} />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.day ?? ""}
                        formatter={(value: number) => [value, "Signups"]}
                      />
                      <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Gold by channel — last 30 days</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.goldByChannel.length === 0 && (
                  <p className="font-serif italic text-muted-foreground">No gold earned in this window yet.</p>
                )}
                {data.goldByChannel.map((c) => (
                  <div key={c.channel}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{c.channel}</span>
                      <span className="text-muted-foreground">{Math.round(c.total).toLocaleString()}d · {c.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              Sampled {new Date(data.sampledAt).toLocaleString()} · window: last {data.windowDays} days · bot ludi excluded
            </p>
          </>
        )}
      </main>
    </div>
  );
}
