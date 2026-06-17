import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trophy, Users, Clock, Sparkles } from "lucide-react";
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

function ContestsPage() {
  const navigate = useNavigate();
  const [contests, setContests] = useState<Contest[]>([]);
  const [entries, setEntries] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const [{ data: cs }, { data: prof }, { data: allEntries }] = await Promise.all([
      supabase.from("contests").select("*").order("ends_at"),
      u.user ? supabase.from("profiles").select("is_pro").eq("id", u.user.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("contest_entries").select("contest_id, user_id"),
    ]);
    setContests((cs ?? []) as Contest[]);
    setIsPro(!!prof?.is_pro);
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
    const { error } = await supabase.from("contest_entries").insert({ contest_id: c.id, user_id: u.user.id });
    if (error) return toast.error(error.message);
    toast.success(c.entry_fee > 0 ? `Entered! (₹${c.entry_fee} fee is a demo)` : "You're in!");
    load();
  }

  return (
    <AppShell>
      <PageHeader title="Contests" subtitle="Win prizes for your best shots" />
      <div className="px-5 pt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)
        ) : contests.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">No contests right now.</div>
        ) : (
          contests.map((c) => {
            const count = entries[c.id] ?? 0;
            const pct = Math.min(100, (count / c.max_entries) * 100);
            const daysLeft = Math.max(0, Math.ceil((new Date(c.ends_at).getTime() - Date.now()) / 86400000));
            const entered = mine.has(c.id);
            const locked = c.pro_only && !isPro;
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
                  <span className="inline-flex items-center gap-1"><Trophy className="size-3.5 text-[var(--gold)]" /> ₹{c.prize_amount.toLocaleString()}</span>
                  <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {count}/{c.max_entries}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {daysLeft}d left</span>
                </div>
                <Progress value={pct} className="h-1.5 mt-2.5" />
                <div className="mt-3">
                  {locked ? (
                    <Button size="sm" className="w-full" variant="outline" onClick={() => navigate({ to: "/go-pro" })}>
                      <Sparkles className="size-3.5 mr-1" /> Upgrade to enter
                    </Button>
                  ) : entered ? (
                    <Button size="sm" className="w-full" disabled>You're entered ✓</Button>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => enter(c)}>
                      {c.entry_fee > 0 ? `Enter · ₹${c.entry_fee}` : "Enter free"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
