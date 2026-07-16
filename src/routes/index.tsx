import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="font-display text-xl tracking-widest text-primary">GLADIVS · LVDVS</div>
          <nav className="flex items-center gap-3">
            {signedIn ? (
              <Button asChild><Link to="/ludus">Enter your Ludus</Link></Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate({ to: "/auth" })}>Sign in</Button>
                <Button onClick={() => navigate({ to: "/auth" })}>Begin</Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="laurel font-serif italic text-muted-foreground">Anno Domini MMXXVI</p>
        <h1 className="mt-6 font-display text-6xl font-semibold text-ink md:text-7xl">
          Gladius Ludus
        </h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-xl italic text-muted-foreground md:text-2xl">
          Rise as lanista of Rome. Recruit slaves and freemen, forge them into gladiators,
          and send them into the sand to win coin, fame — and the mercy of the crowd.
        </p>

        <div className="mt-10 flex justify-center gap-3">
          {signedIn ? (
            <Button size="lg" asChild><Link to="/ludus">Enter your Ludus</Link></Button>
          ) : (
            <Button size="lg" onClick={() => navigate({ to: "/auth" })}>Found your Ludus</Button>
          )}
        </div>

        <div className="mt-24 grid gap-8 md:grid-cols-3">
          {[
            { t: "Recruit", d: "Scour the provinces for fresh blood — Thracians, Gauls, Nubians, all with different aptitudes." },
            { t: "Train", d: "Drill strength, agility, stamina and technique in the palaestra. Every denarius counts." },
            { t: "Conquer", d: "Choose your foe. Choose your risk. Wounds heal — reputation is forever." },
          ].map((f) => (
            <div key={f.t} className="inscribed ornate-border rounded-lg p-6 text-left">
              <h3 className="font-display text-xl text-primary">{f.t}</h3>
              <p className="mt-3 font-serif text-base text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/70 py-8 text-center font-serif text-sm italic text-muted-foreground">
        Panem et circenses.
      </footer>
    </div>
  );
}
