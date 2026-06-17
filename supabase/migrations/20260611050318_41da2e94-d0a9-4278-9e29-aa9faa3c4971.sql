
-- ENUMS
CREATE TYPE public.photo_category AS ENUM ('nail_art', 'barefoot', 'aesthetic', 'other');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  city TEXT,
  is_pro BOOLEAN NOT NULL DEFAULT FALSE,
  pro_until TIMESTAMPTZ,
  stripe_customer_id TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PHOTOS
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category photo_category NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.photos TO authenticated;
GRANT SELECT ON public.photos TO anon;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos_read_all" ON public.photos FOR SELECT USING (true);
CREATE POLICY "photos_insert_own" ON public.photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_delete_own" ON public.photos FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_photos_user ON public.photos(user_id);
CREATE INDEX idx_photos_category ON public.photos(category);

-- RATINGS
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(photo_id, rater_id)
);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT SELECT ON public.ratings TO anon;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_read_all" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_own" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);
CREATE INDEX idx_ratings_photo ON public.ratings(photo_id);
CREATE INDEX idx_ratings_rater ON public.ratings(rater_id);
CREATE INDEX idx_ratings_created ON public.ratings(created_at);

-- STREAKS
CREATE TABLE public.user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE
);
GRANT SELECT, INSERT, UPDATE ON public.user_streaks TO authenticated;
GRANT ALL ON public.user_streaks TO service_role;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks_read_all" ON public.user_streaks FOR SELECT USING (true);
CREATE POLICY "streaks_upsert_self" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "streaks_update_self" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);

-- CONTESTS
CREATE TABLE public.contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  prize_amount INT NOT NULL DEFAULT 0,
  entry_fee INT NOT NULL DEFAULT 0,
  pro_only BOOLEAN NOT NULL DEFAULT FALSE,
  max_entries INT NOT NULL DEFAULT 100,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contests TO authenticated, anon;
GRANT ALL ON public.contests TO service_role;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contests_read_all" ON public.contests FOR SELECT USING (true);

-- CONTEST ENTRIES
CREATE TABLE public.contest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contest_id, user_id)
);
GRANT SELECT, INSERT ON public.contest_entries TO authenticated;
GRANT SELECT ON public.contest_entries TO anon;
GRANT ALL ON public.contest_entries TO service_role;
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries_read_all" ON public.contest_entries FOR SELECT USING (true);
CREATE POLICY "entries_insert_self" ON public.contest_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed contests
INSERT INTO public.contests (title, description, prize_amount, entry_fee, pro_only, max_entries, ends_at) VALUES
('Best Nail Art of the Week', 'Show off your most creative nail design and win cash.', 5000, 0, FALSE, 100, now() + interval '7 days'),
('Aesthetic Vibes Challenge', 'The most aesthetic photo wins. Premium contest for Pro members.', 10000, 0, TRUE, 50, now() + interval '14 days'),
('Barefoot Beauty Contest', 'Show your best barefoot shot. Small entry fee, big prize pool.', 15000, 49, FALSE, 200, now() + interval '21 days');

-- STORAGE POLICIES for 'photos' bucket (bucket created separately)
CREATE POLICY "photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "photos_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "photos_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- AUTO-CREATE PROFILE on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  n INT := 0;
BEGIN
  base_username := COALESCE(NULLIF(split_part(NEW.email, '@', 1), ''), 'user');
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  IF base_username = '' THEN base_username := 'user'; END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    n := n + 1;
    final_username := base_username || n::text;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, final_username);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPCs
CREATE OR REPLACE FUNCTION public.get_next_photo(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, user_id UUID, category photo_category, storage_path TEXT,
  username TEXT, city TEXT, avg_score NUMERIC, rating_count BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.user_id, p.category, p.storage_path,
    pr.username, pr.city,
    COALESCE(AVG(r.stars), 0)::NUMERIC AS avg_score,
    COUNT(r.id) AS rating_count
  FROM public.photos p
  JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.ratings r ON r.photo_id = p.id
  WHERE p.user_id <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.ratings rr WHERE rr.photo_id = p.id AND rr.rater_id = auth.uid())
    AND (p_category IS NULL OR p.category::text = p_category)
  GROUP BY p.id, pr.username, pr.city
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_period TEXT DEFAULT 'all', p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  user_id UUID, username TEXT, photo_count BIGINT, rating_count BIGINT, avg_score NUMERIC
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH window_start AS (
    SELECT CASE p_period
      WHEN 'week' THEN now() - interval '7 days'
      WHEN 'month' THEN now() - interval '30 days'
      ELSE 'epoch'::timestamptz
    END AS ts
  )
  SELECT pr.id AS user_id, pr.username,
    COUNT(DISTINCT p.id) AS photo_count,
    COUNT(r.id) AS rating_count,
    COALESCE(AVG(r.stars), 0)::NUMERIC AS avg_score
  FROM public.profiles pr
  LEFT JOIN public.photos p ON p.user_id = pr.id AND (p_category IS NULL OR p.category::text = p_category)
  LEFT JOIN public.ratings r ON r.photo_id = p.id AND r.created_at >= (SELECT ts FROM window_start)
  GROUP BY pr.id, pr.username
  HAVING COUNT(DISTINCT p.id) > 0
  ORDER BY avg_score DESC, rating_count DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (avg_score NUMERIC, photo_count BIGINT, ratings_given BIGINT, ratings_received BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT AVG(r.stars) FROM public.ratings r JOIN public.photos p ON p.id = r.photo_id WHERE p.user_id = p_user_id), 0)::NUMERIC,
    (SELECT COUNT(*) FROM public.photos WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.ratings WHERE rater_id = p_user_id),
    (SELECT COUNT(*) FROM public.ratings r JOIN public.photos p ON p.id = r.photo_id WHERE p.user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_today_rating_count(p_user_id UUID)
RETURNS INT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INT FROM public.ratings
  WHERE rater_id = p_user_id AND created_at::date = CURRENT_DATE;
$$;

CREATE OR REPLACE FUNCTION public.update_streak_for_user(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today_count INT;
  last_date DATE;
  cur_streak INT;
BEGIN
  SELECT COUNT(*) INTO today_count FROM public.ratings
    WHERE rater_id = p_user_id AND created_at::date = CURRENT_DATE;
  IF today_count < 5 THEN RETURN; END IF;
  SELECT last_active_date, current_streak INTO last_date, cur_streak FROM public.user_streaks WHERE user_id = p_user_id;
  IF last_date = CURRENT_DATE THEN RETURN; END IF;
  IF last_date = CURRENT_DATE - 1 THEN
    UPDATE public.user_streaks SET current_streak = current_streak + 1, last_active_date = CURRENT_DATE WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.user_streaks (user_id, current_streak, last_active_date)
      VALUES (p_user_id, 1, CURRENT_DATE)
      ON CONFLICT (user_id) DO UPDATE SET current_streak = 1, last_active_date = CURRENT_DATE;
  END IF;
END;
$$;
