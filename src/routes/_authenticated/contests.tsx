import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trophy, Users, Clock, Sparkles, Coins, Crown, Medal } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/contests")({
  component: ContestsPage,
});

type Contest = {
  id: string; title: string; description: string; prize_amount: number; entry_fee: number;
  pro_only: boolean; max_entries: number; ends_at: string;
};

type LBEntry = {
  entry_id: string; user_id: string; username: string; storage_path: string; avg_score: number; vote_count: number;
};

function ContestsPage() {
  const navigate = useNavigate();
  const [contests, setContests] = useState<Contest[]>([]);
  const [entries, setEntries] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [isPro, setIsPro] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myPhotos, setMyPhotos] = useState<{ id: string; storage_path: string }[]>([]);
  const [enteringContest, setEnteringContest] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Record<string, LBEntry[]>>({});
  const [showLB, setShowLB] = useState<string | null>(null);
  const [lbLoading, setLbLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const [{ data: cs }, { data: prof }, { data: allEntries }, { data: coins }, { data: photos }] = await Promise.all([
      supabase.from("contests").select("*").order("ends_at"),
      u.user ? supabase.from("profiles").select("is_pro").eq("id", u.user.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("contest_entries").select("contest_id, user_id"),
      u.user ? supabase.from("user_coins").select("balance").eq("user_id", u.user.id).maybeSingle() : Promise.resolve({ data: null }),
      u.user ? supabase.from("photos").select("id, storage_path").eq("user_id", u.user.id).eq("status", "approved").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    setContests((cs ?? []) as Contest[]);
    setIsPro(!!prof?.is_pro);
    setCoinBalance(coins?.balance ?? 0);
    setMyPhotos((photos ?? []) as any);
    const counts: Record<string, number> = {};
    const myset = new Set<string>();
    (allEntries ?? []).forEach((e: any) => {
      counts[e.contest_id] = (counts[e.contest_id] ?? 0) + 1;
      if (u.user && e.user_id === u.user.id) myset.add(e.contest_id);
    });
    setEntries(counts); setMine(myset);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function enter(c: Contest) {
    if (c.pro_only && !isPro) { navigate({ to: "/go-pro" }); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (myPhotos.length === 0) { toast.error("No approved photos to enter with"); return; }
    if (c.entry_fee > 0 && coinBalance < c.entry_fee) { toast.error("Not enough Sole Coins"); return; }
    setEnteringContest(c.id);
    try {
      const pick = myPhotos[0];
      const { data, error } = await supabase.rpc("try_contest_entry", { p_user_id: u.user.id, p_contest_id: c.id, p_photo_id: pick.id });
      if (error) throw error;
      if (data === "insufficient_coins") { toast.error("Not enough Sole Coins"); return; }
      if (data === "full") { toast.error("Contest is full"); return; }
      if (data === "ok") {
        toast.success(c.entry_fee > 0 ? `Entered! (${c.entry_fee} coins spent)` : "You're in!");
        load();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not enter contest");
    } finally {
      setEnteringContest(null);
    }
  }

  async function loadLeaderboard(contestId: string) {
    setLbLoading(true);
    setShowLB(contestId);
    const { data, error } = await supabase.rpc("get_contest_leaderboard", { p_contest_id: contestId });
    if (error) { toast.error(error.message); setLbLoading(false); return; }
    setLeaderboard((prev) => ({ ...prev, [contestId]: (data ?? []) as any }));
    setLbLoading(false);
  }

  return (
    <AppShell>
      <PageHeader title="Contests" subtitle="Win prizes for your best shots" />
      <div className="px-5 pt-4 space-y-3">
        {coinBalance > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
            <Coins className="size-4" /> {coinBalance} Sole Coins
          </div>
        )}
        {!loading && myPhotos.length === 0 && (
          <div className="text-center text-xs text-muted-foreground pb-1">You need an approved photo to enter contests</div>
        )}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />)
        ) : contests.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">No contests right now.</div>
        ) : (
          contests.map((c) => {
            const count = entries[c.id] ?? 0;
            const pct = Math.min(100, (count / c.max_entries) * 100);
            const daysLeft = Math.max(0, Math.ceil((new Date(c.ends_at).getTime() - Date.now()) / 86400000));
            const entered = mine.has(c.id);
            const locked = c.pro_only && !isPro;
            const lb = leaderboard[c.id];
            return (
              <div key={c.id} className="rounded-2xl bg-card dark:bg-card/80 border border-border shadow-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base">{c.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                  </div>
                  {c.pro_only && <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0">PRO</Badge>}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Trophy className="size-3.5 text-[var(--gold)]" /> {c.prize_amount > 0 ? `₹${c.prize_amount.toLocaleString()}` : "Glory"}</span>
                  <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {count}/{c.max_entries}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {daysLeft}d left</span>
                  {c.entry_fee > 0 && <span className="inline-flex items-center gap-1"><Coins className="size-3.5" /> {c.entry_fee}</span>}
                </div>
                <Progress value={pct} className="h-1.5 mt-2.5" />
                <div className="mt-3 flex gap-2">
                  {locked ? (
                    <Button size="sm" className="flex-1" variant="outline" onClick={() => navigate({ to: "/go-pro" })}>
                      <Sparkles className="size-3.5 mr-1" /> Upgrade
                    </Button>
                  ) : entered ? (
                    <Button size="sm" className="flex-1" variant="secondary" disabled>Entered ✓</Button>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => enter(c)} disabled={enteringContest === c.id || myPhotos.length === 0}>
                      {enteringContest === c.id ? "Entering..." : c.entry_fee > 0 ? `Enter · ${c.entry_fee} coins` : "Enter free"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => showLB === c.id ? setShowLB(null) : loadLeaderboard(c.id)}>
                    <Crown className="size-3.5" />
                  </Button>
                </div>
                {showLB === c.id && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Medal className="size-3.5" /> Leaderboard</h4>
                    {lbLoading ? (
                      <div className="h-20 rounded-lg bg-muted animate-pulse" />
                    ) : lb && lb.length > 0 ? (
                      <div className="space-y-1.5">
                        {lb.map((e, i) => (
                          <div key={e.entry_id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-1.5">
                            <span className="font-medium">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`} @{e.username}
                            </span>
                            <span>⭐ {Number(e.avg_score).toFixed(1)} ({e.vote_count})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No entries yet.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
