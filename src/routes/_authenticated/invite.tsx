import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Share2, Copy, Users, Coins, Gift, Check } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/invite")({
  component: InvitePage,
});

function InvitePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [stats, setStats] = useState<{ total_referrals: number; coins_earned: number; current_balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth", replace: true }); return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", u.user.id)
        .single();

      if (p) setUsername(p.username);

      const { data: s } = await supabase.rpc("get_referral_stats", { p_user_id: u.user.id });
      if (s) setStats(s as any);

      setLoading(false);
    })();
  }, [navigate]);

  const link = username ? `${window.location.origin}/auth?ref=${username}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on SoleMate!",
          text: "Rate feet, compete in contests, and earn coins!",
          url: link,
        });
      } catch {}
    } else {
      copyLink();
    }
  }

  return (
    <AppShell>
      <PageHeader title="Invite friends" />
      <div className="px-5 pt-5 space-y-4 pb-8">

        <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white p-6 text-center shadow-lg animate-pop-in">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-heading font-bold">Refer a friend</h2>
          <p className="text-sm text-white/80 mt-1 max-w-xs mx-auto">
            Share your link and earn <strong>20 coins</strong> for every friend who joins!
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/50 shadow-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="size-4 text-primary" />
            <span className="text-xs font-heading font-semibold">Your referral link</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2.5 border border-border/40">
            <span className="text-xs font-mono truncate flex-1">{link || "Loading…"}</span>
            <button onClick={copyLink} className="size-7 rounded-lg bg-card border border-border/40 flex items-center justify-center hover:bg-muted transition-colors shrink-0" aria-label="Copy">
              {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
            </button>
          </div>
          <Button onClick={shareLink} className="w-full mt-3 rounded-xl gap-1.5">
            <Share2 className="size-4" /> Share link
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 p-4 text-center">
            <Users className="size-5 mx-auto text-violet-500" />
            <p className="text-2xl font-bold font-heading tabular-nums mt-1">
              {loading ? "…" : stats?.total_referrals ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Friends joined</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4 text-center">
            <Coins className="size-5 mx-auto text-emerald-500" />
            <p className="text-2xl font-bold font-heading tabular-nums mt-1">
              {loading ? "…" : (stats?.coins_earned ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Coins earned</p>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border/50 shadow-card p-4">
          <h3 className="text-xs font-heading font-semibold flex items-center gap-1.5 mb-2">
            <Coins className="size-3.5 text-primary" /> How it works
          </h3>
          <ul className="text-[11px] text-muted-foreground space-y-2 ml-1">
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">1.</span>
              Share your unique link with friends
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">2.</span>
              They sign up using your link
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">3.</span>
              You get <strong className="text-foreground">20 coins</strong> instantly!
            </li>
          </ul>
        </div>

      </div>
    </AppShell>
  );
}
