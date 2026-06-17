import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.99_0.005_50)] to-[oklch(0.97_0.01_30)] flex items-start justify-center px-5 py-16">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="rounded-3xl bg-white/90 backdrop-blur shadow-card border border-border/60 p-8">
          <a href="/auth" className="text-sm text-primary font-heading font-medium hover:underline">&larr; Back</a>
          <h1 className="text-2xl font-heading font-bold mt-4 mb-6">Privacy Policy</h1>

          <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">1. What We Collect</h2>
              <p>When you use SoleMate, we may collect:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Account information (email, username, avatar) if you sign up</li>
                <li>Photos you upload for rating</li>
                <li>Ratings and comments you submit</li>
                <li>Anonymous usage data to improve the app</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">2. How We Use Your Data</h2>
              <p>Your data is used solely to operate SoleMate: display your profile, show your photos, calculate ratings, and run contests. We do not sell your personal information or photos to third parties.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">3. Photo Moderation</h2>
              <p>All uploaded photos are reviewed by our moderation team before being shown publicly. Photos that violate our guidelines are rejected and removed.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">4. Third-Party Services</h2>
              <p>We use Supabase for authentication and storage. Google OAuth is used if you choose to sign in with Google. Each service has its own privacy policy governing how it handles your data.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">5. Data Retention</h2>
              <p>You can delete your account and all associated data at any time from your profile settings. Photos you upload may remain visible to others until deleted.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">6. Contact</h2>
              <p>If you have questions about this policy, please contact us at privacy@solemate.app.</p>
            </section>

            <p className="text-xs text-muted-foreground/60 pt-4 border-t border-border/40">Last updated: June 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
