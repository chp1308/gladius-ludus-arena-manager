import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AchievementWatcher } from "@/components/achievement-watcher";
import { GlobalEventBanner } from "@/components/global-event-banner";
import { TutorialGuide } from "@/components/tutorial-guide";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <>
      <GlobalEventBanner />
      <Outlet />
      <AchievementWatcher />
      <TutorialGuide />
    </>
  ),
});
