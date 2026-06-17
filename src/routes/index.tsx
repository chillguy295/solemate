import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/rate", replace: true });
      else navigate({ to: "/auth", replace: true });
    })();
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[oklch(0.99_0.005_50)] to-[oklch(0.97_0.01_30)]">
      <div className="text-center animate-pop-in">
        <div className="text-4xl font-heading font-bold tracking-tight text-primary">SoleMate</div>
        <div className="mt-2 text-sm text-muted-foreground">Loading…</div>
      </div>
    </div>
  );
}
