import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.99_0.005_50)] to-[oklch(0.97_0.01_30)] flex items-start justify-center px-5 py-16">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="rounded-3xl bg-white/90 backdrop-blur shadow-card border border-border/60 p-8">
          <a href="/auth" className="text-sm text-primary font-heading font-medium hover:underline">&larr; Back</a>
          <h1 className="text-2xl font-heading font-bold mt-4 mb-6">Terms &amp; Conditions</h1>

          <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">1. Acceptance</h2>
              <p>By creating an account or using SoleMate, you agree to these terms. If you do not agree, do not use the app.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">2. User Conduct</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Upload offensive, illegal, or explicit content</li>
                <li>Harass, bully, or abuse other users</li>
                <li>Manipulate ratings or use bots</li>
                <li>Attempt to bypass moderation or security measures</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">3. Content Ownership</h2>
              <p>You retain ownership of photos you upload. By uploading, you grant SoleMate a non-exclusive license to display your photos on the platform. You may remove your photos at any time.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">4. Moderation</h2>
              <p>We reserve the right to remove any content and suspend or ban accounts that violate these terms. Moderator decisions are final.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">5. Disclaimer</h2>
              <p>SoleMate is provided "as is" without warranties of any kind. We are not liable for damages arising from your use of the app.</p>
            </section>

            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-2">6. Changes</h2>
              <p>We may update these terms at any time. Continued use after changes means you accept the new terms.</p>
            </section>

            <p className="text-xs text-muted-foreground/60 pt-4 border-t border-border/40">Last updated: June 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
