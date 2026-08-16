import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminLogin, adminLogout, adminSessionStatus, getAdminStats } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, ShieldCheck } from "lucide-react";

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
