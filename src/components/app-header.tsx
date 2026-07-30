import type { ReactNode } from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Every page's action is onClick-based (even plain navigation) so this
// component never has to know about the router's typed route literals —
// each page writes its own `navigate({ to: "/..." })` call where TanStack
// Router can actually type-check it.
export type HeaderAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "outline" | "ghost" | "default" | "destructive";
};

// Shared page header: title (+ optional back arrow and meta line) on the
// left, actions on the right. Actions render inline from lg: up; below
// that they collapse into a single menu button so a long nav list (the
// Ludus hub has 6 items plus a primary CTA) can never blow the page out to
// a wider scrollWidth than the viewport, or squeeze the title down to
// nothing — both bugs hit at the in-between tablet widths (sm collapses
// too late for 7 buttons; a fixed lg: cutoff is safe for every page's
// action count without needing per-page tuning).
export function AppHeader({
  backTo, title, meta, actions = [], primaryAction, maxWidth = "max-w-6xl",
}: {
  backTo?: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: HeaderAction[];
  // A CTA important enough to stay visible at every width instead of
  // collapsing into the menu (e.g. "Fights" on the Ludus hub).
  primaryAction?: HeaderAction;
  maxWidth?: string;
}) {
  return (
    <header className="border-b border-border/70 bg-card/60 backdrop-blur">
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-3 px-4 py-4 sm:px-6`}>
        <div className="flex min-w-0 items-center gap-4">
          {backTo && (
            <Link to={backTo} className="shrink-0 text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div className="min-w-0">
            <div className="truncate font-display text-xl tracking-widest text-primary">{title}</div>
            {meta && <div className="mt-1 truncate text-sm font-serif italic text-muted-foreground">{meta}</div>}
          </div>
        </div>

        {(actions.length > 0 || primaryAction) && (
          <div className="flex shrink-0 items-center gap-2">
            {actions.length > 0 && (
              <>
                <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
                  {actions.map(a => (
                    <Button key={a.key} variant={a.variant ?? "outline"} size="sm" onClick={a.onClick}>
                      {a.icon}{a.label}
                    </Button>
                  ))}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden" aria-label="Menu">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {actions.map(a => (
                      <DropdownMenuItem key={a.key} onClick={a.onClick}>
                        {a.icon}{a.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant ?? "default"}
                size="lg"
                className="h-11 px-5 text-base shadow-lg shadow-primary/20"
                onClick={primaryAction.onClick}
              >
                {primaryAction.icon}{primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
