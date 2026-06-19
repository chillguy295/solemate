import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("username, bio, city, onboarded").eq("id", u.user.id).maybeSingle();
      if (p) {
        if (p.onboarded) { navigate({ to: "/rate", replace: true }); return; }
        setUsername(p.username ?? "");
        setBio(p.bio ?? "");
        setCity(p.city ?? "");
      }
      setLoaded(true);
    })();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (clean.length < 3) throw new Error("Username must be at least 3 characters (a-z, 0-9, _)");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({
        username: clean, bio: bio.trim() || null, city: city.trim() || null, onboarded: true,
      }).eq("id", u.user.id);
      if (error) throw error;

      const refCode = localStorage.getItem("referral_code");
      if (refCode) {
        localStorage.removeItem("referral_code");
        const { error: refErr } = await supabase.rpc("create_referral", {
          p_referral_code: refCode,
          p_new_user_id: u.user.id,
        });
        if (refErr) console.warn("Referral failed:", refErr);
      }

      toast.success("Profile saved!");
      navigate({ to: "/rate", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-primary">Welcome to SoleMate</div>
          <p className="mt-1 text-sm text-muted-foreground">Set up your profile to get started.</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl bg-card border border-border shadow-card p-6 space-y-4">
          <div>
            <Label htmlFor="username">Username *</Label>
            <Input id="username" required minLength={3} maxLength={24} value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1.5" placeholder="yourname" />
          </div>
          <div>
            <Label htmlFor="city">City (optional)</Label>
            <Input id="city" maxLength={64} value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" placeholder="Mumbai" />
          </div>
          <div>
            <Label htmlFor="bio">Bio (optional)</Label>
            <Textarea id="bio" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1.5" placeholder="A short intro" />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Continue"}</Button>
        </form>
      </div>
    </div>
  );
}
