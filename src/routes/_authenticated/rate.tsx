import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Flame, MapPin, Heart, Flag } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PhotoImage } from "@/components/photo-image";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rate")({
  component: RatePage,
});

const DAILY_GOAL = 10;

type NextPhoto = {
  id: string;
  user_id: string;
  category: string;
  storage_path: string;
  username: string;
  city: string | null;
  caption: string | null;
  avg_score: number;
  rating_count: number;
};

function RatePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string | null>(null);
  const [photo, setPhoto] = useState<NextPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [unlockedPicks, setUnlockedPicks] = useState(false);
  const [ratedId, setRatedId] = useState<string | null>(null);

  async function ensureOnboarded() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const { data: p } = await supabase.from("profiles").select("onboarded").eq("id", u.user.id).maybeSingle();
    if (!p?.onboarded) { navigate({ to: "/onboarding", replace: true }); return false; }
    return true;
  }

  async function loadCounts() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: tc } = await supabase.rpc("get_today_rating_count", { p_user_id: u.user.id });
    setTodayCount(Number(tc ?? 0));
    const { data: s } = await supabase.from("user_streaks").select("current_streak").eq("user_id", u.user.id).maybeSingle();
    setStreak(s?.current_streak ?? 0);
  }

  async function loadNext() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_next_photo", { p_category: filter ?? undefined });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setPhoto(data?.[0] ?? null);
    setLoading(false);
  }

  useEffect(() => {
    (async () => { if (await ensureOnboarded()) { await loadCounts(); await loadNext(); } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function onRate(stars: number) {
    if (!photo || busy) return;
    setBusy(true);
    setRatedId(photo.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("ratings").insert({ photo_id: photo.id, rater_id: u.user.id, stars });
      if (error) throw error;
      const newCount = todayCount + 1;
      setTodayCount(newCount);
      if (newCount === 5 && !unlockedPicks) {
        setUnlockedPicks(true);
        toast.success("You unlocked premium picks!", { description: "Keep rating to climb the leaderboard." });
      }
      if (newCount >= 5) {
        await supabase.rpc("update_streak_for_user", { p_user_id: u.user.id });
        await loadCounts();
      }
      setTimeout(async () => {
        setRatedId(null);
        await loadNext();
      }, 400);
    } catch (e: any) {
      toast.error(e.message ?? "Could not rate");
      setRatedId(null);
    } finally {
      setBusy(false);
    }
  }

  const filters = useMemo(() => [{ value: null as string | null, label: "All" }, ...CATEGORIES.slice(0, 3).map((c) => ({ value: c.value, label: c.label }))], []);
  const progressPct = Math.min(100, (todayCount / DAILY_GOAL) * 100);

  const pickCopy = todayCount === 0 ? "Start rating!" : todayCount < 5 ? `${5 - todayCount} more to unlock picks` : "Picks unlocked!";

  return (
    <AppShell>
      <PageHeader
        title="Rate"
        right={
          <div className="inline-flex items-center gap-1.5 text-sm font-heading font-semibold rounded-full bg-primary/10 text-primary px-3 py-1">
            <Flame className="size-4" /> {streak}
          </div>
        }
      />
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{todayCount} / {DAILY_GOAL} rated today</span>
          <span className="font-heading text-primary/70">{pickCopy}</span>
        </div>
        <Progress value={progressPct} className="h-2 rounded-full bg-primary/10 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-[oklch(0.75_0.18_15)]" />
      </div>
      <div className="px-5 pt-4 flex gap-2 overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              filter === f.value ? "bg-primary text-primary-foreground shadow-md" : "bg-white dark:bg-card text-foreground border border-border/60 hover:border-primary/30",
            )}
          >{f.label}</button>
        ))}
      </div>

      <div className="px-5 pt-5">
        {loading ? (
          <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5 animate-pulse" />
        ) : !photo ? (
          <EmptyState />
        ) : (
          <div key={photo.id} className={cn(
            "rounded-3xl bg-card border border-border/60 shadow-card overflow-hidden transition-all duration-300 animate-pop-in",
            ratedId === photo.id ? "scale-95 opacity-0" : ""
          )}>
            <div className="relative">
              <PhotoImage path={photo.storage_path} className="w-full aspect-[4/5] object-cover bg-gradient-to-br from-primary/5 to-accent/5" />
            </div>
              <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-lg truncate">@{photo.username}</div>
                  {photo.city && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="size-3" /> {photo.city}
                    </div>
                  )}
                  {photo.caption && (
                    <p className="text-sm text-foreground/80 mt-1.5 italic">&ldquo;{photo.caption}&rdquo;</p>
                  )}
                </div>
                <div className="text-right shrink-0 flex items-start gap-2">
                  <div>
                    <Badge variant="secondary" className="font-heading font-medium rounded-full">{categoryLabel(photo.category)}</Badge>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {photo.rating_count > 0 ? <>⭐ {Number(photo.avg_score).toFixed(1)} · {photo.rating_count}</> : "New"}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const reason = prompt("Why are you reporting this photo?");
                      if (!reason) return;
                      try {
                        const { error } = await supabase.from("photo_reports").insert({ photo_id: photo.id, reason });
                        if (error) throw error;
                        toast.success("Report submitted");
                      } catch (e: any) {
                        toast.error(e.message ?? "Failed to report");
                      }
                    }}
                    className="size-7 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    aria-label="Report photo"
                  >
                    <Flag className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4">
                <StarRating onRate={onRate} disabled={busy} />
                <p className="text-center text-xs text-muted-foreground/60 mt-2">Tap your rating</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-border/60 bg-white/50 dark:bg-card/50 p-10 text-center animate-pop-in">
      <div className="text-5xl mb-3">🌸</div>
      <h3 className="font-heading font-semibold text-lg">All caught up!</h3>
      <p className="mt-1 text-sm text-muted-foreground">New photos are uploaded daily. Check back soon!</p>
    </div>
  );
}
