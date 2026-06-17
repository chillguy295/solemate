# SoleMate Build Plan

A mobile-first photo rating social app. Below is the scope I'll build in this initial version.

## Stack & Backend
- **Lovable Cloud** (Supabase under the hood) for auth, Postgres, and photo storage.
- **Stripe** for the ₹299/month Pro subscription via Lovable's built-in Stripe Payments (no API keys needed from you — test mode works immediately, live mode after you claim the account).
- TanStack Start + React + Tailwind + shadcn for the UI.

## Design
- Clean, mobile-first, white background, soft cards, subtle shadows, rounded corners.
- Blue accent. Single max-width container (~480px) centered on desktop so it feels like a real mobile app.
- Empty + loading states on every page. Toasts via sonner.

## Database (Cloud / Supabase)
- `profiles` (id → auth.users, username unique, bio, city, created_at, is_pro, pro_until)
- `photos` (id, user_id, category enum, storage_path, created_at)
- `ratings` (id, photo_id, rater_id, stars 1–5, created_at; unique(photo_id, rater_id))
- `user_streaks` (user_id, current_streak, last_active_date)
- `contests` (id, title, description, prize, entry_fee, pro_only, ends_at)
- `contest_entries` (id, contest_id, user_id, photo_id)
- Storage bucket `photos` — public read, owner-only write (RLS on storage.objects).
- Views/RPCs: `photo_avg_score`, `user_stats` (avg rating, photo count, ratings received), `leaderboard(period, category)`.
- RLS on every table. `user_roles` table + `has_role()` for any admin needs later.
- Seed 3 contests on first migration.

## Routes (TanStack Start)
- `/auth` — email/password sign in + sign up (public).
- `/onboarding` — username/bio/city after first signup.
- `/_authenticated/` layout with shared bottom nav (4 tabs):
  - `/rate` (home) — one photo card, star rating, category filter, daily progress bar, streak counter, "premium picks unlocked" toast at 5th rating. Excludes own + already-rated photos.
  - `/leaderboard` — ranked users; week/month/all-time tabs; category pills; gold/silver/bronze; current user highlighted; tap → public profile.
  - `/profile` — own profile, stats cards, 3-col photo grid w/ avg scores, upload (5-cap for free), edit, log out.
  - `/contests` — contest cards with progress, entry buttons, Pro-only upgrade prompts.
- `/u/$username` — public profile.
- `/go-pro` — Pro benefits + Stripe checkout (₹299/month).
- `/api/public/stripe-webhook` — flips `is_pro` on subscription events.

## Enforcement
- 5-upload free cap enforced server-side in the upload server function.
- "Hide own photos / already rated" enforced server-side in the next-photo server function.
- Streak = consecutive days with ≥5 ratings, computed server-side on each rating.

## Out of scope for v1 (call out so you know)
- Push notifications, comments, follow graph, contest judging/winners flow, profile avatar upload (using initials circle as spec'd).
- Stripe live mode requires you to claim the account after I enable it — test mode works for development right away.

## Order of execution
1. Enable Lovable Cloud + run schema/RLS/storage migration + seed contests.
2. Enable Stripe Payments + create the ₹299/month product.
3. Build auth + onboarding + bottom-nav layout.
4. Build Rate, Profile (+upload), Leaderboard, Contests, Go Pro pages.
5. Wire Stripe webhook → `is_pro`.
6. Polish empty/loading states + verify in preview.

Approve and I'll start with step 1.