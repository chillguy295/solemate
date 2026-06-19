import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Camera, Star, Clock, Coins, TrendingUp, UserPlus, ArrowRight, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function StatCard({ icon: Icon, label, value, sub, gradient }: { icon: any; label: string; value: string | number; sub?: string; gradient: string }) {
  return (
    <div className="rounded-2xl border border-border/50 shadow-card overflow-hidden animate-pop-in">
      <div className={`${gradient} p-4`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium opacity-80">{label}</p>
            <p className="text-2xl font-bold font-heading tabular-nums mt-0.5">{value}</p>
            {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
          </div>
          <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <Icon className="size-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

type ActivityItem = {
  type: "user" | "photo" | "rating" | "report";
  label: string;
  detail: string;
  time: string;
};

function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, photos: 0, ratings: 0, pending: 0, coins: 0, reports: 0, contests: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [chartData, setChartData] = useState<{ day: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { count: users },
        { count: photos },
        { count: ratings },
        { count: pending },
        { count: reports },
        { count: contests },
        { data: coins },
        { data: recentUsers },
        { data: recentPhotos },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("photos").select("*", { count: "exact", head: true }),
        supabase.from("ratings").select("*", { count: "exact", head: true }),
        supabase.from("photos").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("photo_reports").select("*", { count: "exact", head: true }),
        supabase.from("contests").select("*", { count: "exact", head: true }),
        supabase.from("user_coins").select("balance"),
        supabase.from("profiles").select("username, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("photos").select("created_at, profiles!inner(username)").eq("status", "approved").order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        users: users ?? 0,
        photos: photos ?? 0,
        ratings: ratings ?? 0,
        pending: pending ?? 0,
        coins: (coins ?? []).reduce((s: number, r: any) => s + (r.balance ?? 0), 0),
        reports: reports ?? 0,
        contests: contests ?? 0,
      });

      const items: ActivityItem[] = [];
      (recentUsers ?? []).forEach((u: any) => {
        items.push({ type: "user", label: `@${u.username} joined`, detail: "New user registration", time: u.created_at });
      });
      (recentPhotos ?? []).forEach((p: any) => {
        items.push({ type: "photo", label: `@${(p as any).profiles?.username} uploaded a photo`, detail: "Photo approved", time: p.created_at });
      });
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivity(items.slice(0, 8));

      const days: { day: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        const { count } = await supabase
          .from("ratings")
          .select("*", { count: "exact", head: true })
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());
        days.push({ day: dayStr, value: count ?? 0 });
      }
      setChartData(days);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="px-5 pt-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  const maxChart = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div className="px-5 pt-5 space-y-4 pb-8">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Users" value={stats.users} gradient="bg-gradient-to-br from-violet-600 to-indigo-600 text-white" />
        <StatCard icon={Camera} label="Photos" value={stats.photos} gradient="bg-gradient-to-br from-blue-600 to-cyan-600 text-white" />
        <StatCard icon={Star} label="Ratings" value={stats.ratings} gradient="bg-gradient-to-br from-amber-500 to-orange-600 text-white" />
        <StatCard icon={Coins} label="Coins" value={stats.coins.toLocaleString()} gradient="bg-gradient-to-br from-emerald-500 to-teal-600 text-white" />
        <StatCard icon={Clock} label="Pending" value={stats.pending} sub="Photos to review" gradient="bg-gradient-to-br from-rose-500 to-pink-600 text-white" />
        <StatCard icon={Flag} label="Reports" value={stats.reports} gradient="bg-gradient-to-br from-red-500 to-rose-600 text-white" />
      </div>

      <div className="rounded-2xl border border-border/50 shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-heading font-semibold flex items-center gap-1.5"><TrendingUp className="size-4 text-primary" /> Ratings (7 days)</h3>
        </div>
        <div className="flex items-end gap-2 h-32">
          {chartData.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{d.value}</span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary/30 transition-all duration-500"
                style={{ height: `${(d.value / maxChart) * 100}%`, minHeight: d.value > 0 ? "4px" : "0" }}
              />
              <span className="text-[10px] text-muted-foreground/60">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 shadow-card p-4">
        <h3 className="text-sm font-heading font-semibold flex items-center gap-1.5 mb-3"><UserPlus className="size-4 text-primary" /> Recent activity</h3>
        <div className="space-y-2">
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>
          ) : (
            activity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <div className={cn(
                  "size-7 rounded-full flex items-center justify-center shrink-0 text-[10px]",
                  item.type === "user" ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600" :
                  item.type === "photo" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                  "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                )}>
                  {item.type === "user" ? <UserPlus className="size-3.5" /> : item.type === "photo" ? <Camera className="size-3.5" /> : <Star className="size-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(item.time).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
