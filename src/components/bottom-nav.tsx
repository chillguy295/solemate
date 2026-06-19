import { Link, useRouterState } from "@tanstack/react-router";
import { Star, Trophy, User, Award, Bell, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { to: "/rate", label: "Rate", icon: Star },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/contests", label: "Contests", icon: Award },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fn = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: tc }, { data: role }] = await Promise.all([
        supabase.rpc("get_unread_notification_count", { p_user_id: u.user.id }),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);
      setUnread(Number(tc ?? 0));
      setIsAdmin(!!role);
    };
    fn();
    const interval = setInterval(fn, 30000);
    return () => clearInterval(interval);
  }, []);

  const allTabs = isAdmin ? [...tabs, { to: "/admin", label: "Admin", icon: Shield }] : tabs;

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[440px] z-50">
      <div className={cn("rounded-2xl bg-white/90 dark:bg-card/90 backdrop-blur-lg border border-border/60 shadow-float px-2 py-1.5", isAdmin ? "grid grid-cols-6" : "grid grid-cols-5")}>
        {allTabs.map((t) => {
          const active = pathname.startsWith(t.to) || (t.to === "/notifications" && (pathname.startsWith("/notifications")));
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-xs rounded-xl transition-all relative",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 1.8} />
              <span className={cn("text-[10px]", active && "font-semibold")}>{t.label}</span>
              {t.to === "/notifications" && unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
