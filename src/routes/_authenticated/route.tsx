import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    const { data: u, error } = await supabase.auth.getUser(data.session.access_token);
    if (error || !u.user) throw redirect({ to: "/auth" });
    return { user: u.user };
  },
  component: () => <Outlet />,
});
