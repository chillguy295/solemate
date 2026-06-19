import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Flame, MapPin, Heart, Flag, UserPlus, UserCheck, Send, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PhotoImage } from "@/components/photo-image";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rate")({
  component: RatePage,
});

const DAILY_GOAL = 10;

type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string;
};

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
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [following, setFollowing] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportPhoto, setReportPhoto] = useState<NextPhoto | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const REPORT_REASONS = ["Inappropriate content", "Not a foot photo", "Harassment", "Spam", "Other"];

  async function submitReport(reason: string) {
    if (!reportPhoto || !currentUserId) return;
    setReportBusy(true);
    try {
      const { error } = await supabase.from("photo_reports").insert({ photo_id: reportPhoto.id, reason, reporter_id: currentUserId });
      if (error) throw error;
      toast.success("Report submitted");
      setReportPhoto(null);
      setReportReason("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit report");
    } finally {
      setReportBusy(false);
    }
  }

  const swipeRef = useRef<{ active: boolean; startX: number; stars: number }>({ active: false, startX: 0, stars: 0 });
  const imageRef = useRef<HTMLDivElement>(null);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [swipeStars, setSwipeStars] = useState(0);

  function onPointerDown(e: React.PointerEvent) {
    if (!photo || busy) return;
    imageRef.current?.setPointerCapture(e.pointerId);
    swipeRef.current = { active: true, startX: e.clientX, stars: 0 };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!swipeRef.current.active) return;
    const dx = e.clientX - swipeRef.current.startX;
    const abs = Math.abs(dx);
    if (abs < 30) { setSwipeDir(null); setSwipeStars(0); swipeRef.current.stars = 0; return; }
    const pct = Math.min(1, (abs - 30) / 180);
    let stars = Math.round(dx > 0 ? 3 + pct * 2 : 3 - pct * 2);
    stars = Math.max(1, Math.min(5, stars));
    swipeRef.current.stars = stars;
    setSwipeDir(dx > 0 ? "right" : "left");
    setSwipeStars(stars);
  }
  function onPointerUp() {
    const s = swipeRef.current;
    if (s.active && s.stars > 0) onRate(s.stars);
    s.active = false; s.stars = 0;
    setSwipeDir(null);
    setSwipeStars(0);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

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
    if (filter === "following") {
      const { data, error } = await supabase.rpc("get_followed_photos");
      if (error) { toast.error(error.message); setLoading(false); return; }
      const list = data ?? [];
      setPhoto(list.length > 0 ? list[Math.floor(Math.random() * list.length)] as any : null);
    } else {
      const { data, error } = await supabase.rpc("get_next_photo", { p_category: filter ?? undefined });
      if (error) { toast.error(error.message); setLoading(false); return; }
      setPhoto(data?.[0] ?? null);
    }
    setLoading(false);
  }

  async function loadComments() {
    if (!photo) return;
    const { data, error } = await supabase
      .from("comments")
      .select("id, user_id, body, created_at")
      .eq("photo_id", photo.id)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    const userIds = [...new Set((data ?? []).map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds.length > 0 ? userIds : ["_"]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));
    setComments((data ?? []).map((c) => ({
      id: c.id, user_id: c.user_id, body: c.body,
      created_at: c.created_at, username: profileMap.get(c.user_id) ?? "unknown",
    })));
  }

  async function checkFollow() {
    if (!photo) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", u.user.id)
      .eq("following_id", photo.user_id)
      .maybeSingle();
    setFollowing(!!data);
  }

  async function submitComment() {
    if (!photo || !commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("comments").insert({
        photo_id: photo.id,
        user_id: u.user.id,
        body: commentText.trim(),
      });
      if (error) throw error;
      setCommentText("");
      await loadComments();
    } catch (e: any) {
      toast.error(e.message ?? "Could not post comment");
    } finally {
      setCommentBusy(false);
    }
  }

  async function toggleFollow() {
    if (!photo || !photo.user_id) return;
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (following) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", u.user.id)
          .eq("following_id", photo.user_id);
        if (error) throw error;
        setFollowing(false);
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: u.user.id, following_id: photo.user_id });
        if (error) throw error;
        setFollowing(true);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not update follow");
    }
  }

  useEffect(() => {
    (async () => { if (await ensureOnboarded()) { await loadCounts(); await loadNext(); } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    loadComments();
    checkFollow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo]);

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

  const filters = useMemo(() => [
    { value: null as string | null, label: "All" },
    { value: "following", label: "Following" },
    ...CATEGORIES.slice(0, 3).map((c) => ({ value: c.value, label: c.label })),
  ], []);
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
              <div
                ref={imageRef}
                className="relative select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onDragStart={(e) => e.preventDefault()}
                style={{ touchAction: "none" }}
              >
                <PhotoImage path={photo.storage_path} className="w-full aspect-[4/5] object-cover bg-gradient-to-br from-primary/5 to-accent/5" />
                {swipeDir && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-opacity">
                    <div className={cn(
                      "flex flex-col items-center gap-2 text-white font-bold text-2xl drop-shadow-lg animate-pop-in",
                      swipeDir === "right" ? "text-green-400" : "text-red-400"
                    )}>
                      {swipeDir === "right" ? <ChevronRight className="size-12" /> : <ChevronLeft className="size-12" />}
                      <span>{swipeStars}★</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link to="/u/$username" params={{ username: photo.username }} className="font-heading font-semibold text-lg truncate hover:text-primary transition-colors">@{photo.username}</Link>
                    {currentUserId !== photo.user_id && (
                      <button
                        onClick={toggleFollow}
                        className={cn(
                          "shrink-0 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                          following
                            ? "bg-primary/10 text-primary"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        {following ? <UserCheck className="size-3" /> : <UserPlus className="size-3" />}
                        {following ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
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
                    onClick={() => setReportPhoto(photo)}
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
              <div className="mt-4 pt-4 border-t border-border/40">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="size-4 text-primary" />
                  <span className="text-sm font-heading font-semibold">Comments</span>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-none mb-3">
                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">No comments yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="text-sm">
                        <span className="font-medium text-primary">@{c.username}</span>
                        <span className="text-foreground/80 ml-1.5">{c.body}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
                    placeholder="Write a comment…"
                    className="flex-1 rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                  <button
                    onClick={submitComment}
                    disabled={!commentText.trim() || commentBusy}
                    className="shrink-0 size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!reportPhoto} onOpenChange={(o) => { if (!o) { setReportPhoto(null); setReportReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Report photo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Why are you reporting this photo?</p>
          <div className="space-y-1.5 mt-3">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => submitReport(r)}
                disabled={reportBusy}
                className="w-full text-left p-3 rounded-xl border border-border/60 text-sm hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40"
              >
                {r}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1.5">Or write a custom reason:</p>
            <div className="flex gap-2">
              <Textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Custom reason…"
                maxLength={280}
                className="rounded-xl min-h-0 h-20 resize-none"
              />
              <Button
                onClick={() => { if (reportReason.trim()) submitReport(reportReason.trim()); }}
                disabled={!reportReason.trim() || reportBusy}
                className="rounded-xl shrink-0 self-end"
              >
                Send
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => { setReportPhoto(null); setReportReason(""); }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
