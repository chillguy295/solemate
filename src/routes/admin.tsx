import { createFileRoute, Link, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Image, Flag, Trophy, Users, Send, ArrowLeft } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/photos", label: "Photos", icon: Image },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/contests", label: "Contests", icon: Trophy },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/push", label: "Push", icon: Send },
];

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (!data) { setIsAdmin(false); return; }
      setIsAdmin(true);
    })();
  }, []);

  if (isAdmin === false) {
    return (
      <AppShell>
        <PageHeader title="Admin" />
        <div className="px-5 pt-20 text-center animate-pop-in">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-lg font-heading font-semibold">Access denied</h2>
          <p className="text-sm text-muted-foreground mt-1">You need admin privileges.</p>
          <button onClick={() => navigate({ to: "/rate" })} className="mt-4 text-sm text-primary hover:underline">Back to app</button>
        </div>
      </AppShell>
    );
  }

  if (isAdmin === null) {
    return (
      <AppShell>
        <PageHeader title="Admin" />
        <div className="px-5 pt-5 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Admin"
        right={
          <Link to="/rate" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Back to app">
            <ArrowLeft className="size-5" />
          </Link>
        }
      />
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <nav className="flex gap-0.5 overflow-x-auto scrollbar-none px-4">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </AppShell>
  );
}
