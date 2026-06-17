import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

type Row = { user_id: string; username: string; photo_count: number; rating_count: number; avg_score: number };

const PERIODS = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
] as const;

function LeaderboardPage() {
  const [period, setPeriod] = useState<typeof PERIODS[number]["value"]>("week");
  const [category, setCategory] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  useEffect(() => {
    setLoading(true);
    supabase.rpc("get_leaderboard", { p_period: period, p_category: category ?? undefined }).then(({ data }) => {
      setRows((data ?? []) as Row[]);
      setLoading(false);
    });
  }, [period, category]);

  return (
    <AppShell>
      <PageHeader title="Leaderboard" subtitle="Top rated creators" />
      <div className="px-5 pt-4">
        <div className="flex gap-1 p-1 bg-muted dark:bg-muted/50 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition",
                period === p.value ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >{p.label}</button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 scrollbar-none">
          {[{ value: null as string | null, label: "All" }, ...CATEGORIES.slice(0, 3).map(c => ({ value: c.value, label: c.label }))].map((f) => (
            <button
              key={f.label}
              onClick={() => setCategory(f.value)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-xs font-medium border",
                category === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border",
              )}
            >{f.label}</button>
          ))}
        </div>
      </div>
      <div className="px-5 pt-4 space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)
        ) : rows.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">No data yet — upload photos and start the competition.</div>
        ) : (
          rows.map((r, i) => {
            const isMe = r.user_id === me;
            return (
              <Link
                key={r.user_id}
                to="/u/$username"
                params={{ username: r.username }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition",
                  isMe ? "bg-accent/60 border-primary/40" : "bg-card border-border hover:bg-muted/50",
                )}
              >
                <RankBadge rank={i + 1} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">@{r.username} {isMe && <span className="text-xs text-primary">· you</span>}</div>
                  <div className="text-xs text-muted-foreground">{r.photo_count} photos · {r.rating_count} ratings</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[var(--star)]">⭐ {Number(r.avg_score).toFixed(2)}</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="size-9 rounded-full bg-[var(--gold)]/20 flex items-center justify-center"><Trophy className="size-5 text-[var(--gold)]" /></div>;
  if (rank === 2) return <div className="size-9 rounded-full bg-[var(--silver)]/30 flex items-center justify-center"><Medal className="size-5 text-[var(--silver)]" /></div>;
  if (rank === 3) return <div className="size-9 rounded-full bg-[var(--bronze)]/20 flex items-center justify-center"><Award className="size-5 text-[var(--bronze)]" /></div>;
  return <div className="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</div>;
}
