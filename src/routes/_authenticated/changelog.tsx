import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { CHANGELOG } from "@/lib/changelog";

export const Route = createFileRoute("/_authenticated/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — Gladius Ludus" },
      { name: "description", content: "What's new in Gladius Ludus." },
    ],
  }),
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <div className="min-h-screen">
      <AppHeader backTo="/ludus" maxWidth="max-w-3xl" title="Changelog" />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {CHANGELOG.map((entry) => (
          <Card key={entry.date} className="p-6">
            <div className="mb-1 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
              <History className="h-5 w-5" /> {entry.title}
            </div>
            <p className="mb-4 font-serif text-xs italic text-muted-foreground">
              {new Date(entry.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <ul className="space-y-2 text-sm font-serif leading-relaxed text-muted-foreground">
              {entry.items.map((item, i) => (
                <li key={i} className="border-l-2 border-border pl-3">{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </main>
    </div>
  );
}
