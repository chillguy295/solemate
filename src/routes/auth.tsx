import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/rate", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome to SoleMate!");
        navigate({ to: "/onboarding", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/rate", replace: true });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.99_0.005_50)] to-[oklch(0.97_0.01_30)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm animate-pop-in">
        <div className="text-center mb-8">
          <div className="text-4xl font-heading font-bold tracking-tight text-primary">SoleMate</div>
          <p className="mt-2 text-sm text-muted-foreground">Rate photos. Climb the leaderboard. Win contests.</p>
        </div>
        <div className="rounded-3xl bg-white/90 backdrop-blur shadow-card border border-border/60 p-6">
          <div className="flex gap-1 p-1 bg-muted/60 rounded-xl mb-5">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-heading font-medium rounded-lg transition-all ${mode === m ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 rounded-xl border-border/60" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 rounded-xl border-border/60" />
            </div>
            {mode === "signup" && (
              <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-md border-border/60 text-primary focus:ring-primary/30 accent-primary"
                />
                <span>
                  I agree to the{" "}
                  <a href="/terms" className="text-primary font-medium hover:underline">Terms &amp; Conditions</a>
                  {" "}and{" "}
                  <a href="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</a>
                </span>
              </label>
            )}
            <Button type="submit" className="w-full rounded-xl" disabled={busy || (mode === "signup" && !termsAccepted)}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="mt-4 space-y-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground/60">or</span>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full rounded-xl border-border/60 hover:border-primary/30" onClick={async () => {
              setBusy(true);
              try {
                const { error } = await supabase.auth.signInAnonymously();
                if (error) throw error;
                navigate({ to: "/rate", replace: true });
              } catch (e: any) {
                toast.error(e.message ?? "Failed");
              } finally {
                setBusy(false);
              }
            }} disabled={busy}>
              Browse as guest
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-xl border-border/60 hover:border-primary/30" onClick={async () => {
              setBusy(true);
              try {
                const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
                if (error) throw error;
              } catch (e: any) {
                toast.error(e.message ?? "Failed");
              } finally {
                setBusy(false);
              }
            }} disabled={busy}>
              Continue with Google
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
