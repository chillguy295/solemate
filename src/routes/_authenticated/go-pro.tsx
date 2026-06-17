import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/go-pro")({
  component: GoProPage,
});

const BENEFITS = [
  "Unlimited photo uploads",
  "See who rated your photos",
  "Feed priority — get rated faster",
  "Pro-only contests & bigger prizes",
  "Pro badge on your profile",
];

function GoProPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-purple-50 dark:from-blue-950 dark:via-background dark:to-purple-950 mx-auto w-full max-w-[480px]">
      <div className="px-5 pt-5">
        <button onClick={() => navigate({ to: "/profile" })} className="text-muted-foreground"><ArrowLeft className="size-5" /></button>
      </div>
      <div className="px-5 pt-8 text-center">
        <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-4 shadow-lg">
          <Sparkles className="size-8" />
        </div>
        <h1 className="text-3xl font-bold">SoleMate Pro</h1>
        <p className="text-muted-foreground mt-2">Unlock everything. Be the best.</p>
      </div>
      <div className="px-5 mt-8">
        <div className="rounded-2xl bg-card border border-border shadow-card p-6">
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="size-3" strokeWidth={3} />
                </div>
                <span className="text-sm">{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 text-center">
            <div className="text-4xl font-bold">₹299<span className="text-base font-normal text-muted-foreground">/month</span></div>
            <p className="text-xs text-muted-foreground mt-1">Cancel anytime</p>
          </div>
          <Button
            className="w-full mt-5 h-12 text-base bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90"
            onClick={() => toast.info("Stripe checkout coming soon", { description: "Payments will be wired up in the next step." })}
          >
            Subscribe to Pro
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">Secure payments via Stripe</p>
      </div>
    </div>
  );
}
