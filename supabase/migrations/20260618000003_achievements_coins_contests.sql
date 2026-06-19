-- Achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('ratings_total', 'photos_total', 'streak_days', 'followers_total', 'avg_score')),
  condition_value INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO public.achievements (id, title, description, icon, condition_type, condition_value, sort_order) VALUES
  ('first_rating', 'First Step', 'Rate your first photo', '👣', 'ratings_total', 1, 1),
  ('centurion', 'Centurion', 'Rate 100 photos', '💯', 'ratings_total', 100, 2),
  ('rating_master', 'Rating Master', 'Rate 500 photos', '👑', 'ratings_total', 500, 3),
  ('first_photo', 'Photographer', 'Upload your first photo', '📸', 'photos_total', 1, 4),
  ('photo_collector', 'Collector', 'Upload 10 photos', '🖼️', 'photos_total', 10, 5),
  ('on_fire', 'On Fire', '7 day streak', '🔥', 'streak_days', 7, 6),
  ('dedicated', 'Dedicated', '30 day streak', '⚡', 'streak_days', 30, 7),
  ('popular', 'Popular', 'Get 10 followers', '⭐', 'followers_total', 10, 8),
  ('influencer', 'Influencer', 'Get 50 followers', '🌟', 'followers_total', 50, 9),
  ('top_tier', 'Top Tier', 'Average rating of 4.5+ on 10+ photos', '🏆', 'avg_score', 45, 10);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id TEXT REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read achievements" ON public.user_achievements FOR SELECT USING (true);

-- Sole Coins
CREATE TABLE IF NOT EXISTS public.user_coins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0 NOT NULL CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn_rating', 'earn_upload', 'earn_login', 'spend_boost', 'spend_contest')),
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own coins" ON public.user_coins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own transactions" ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert coins" ON public.user_coins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update coins" ON public.user_coins FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON public.coin_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON public.coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created ON public.coin_transactions(created_at DESC);

-- Contests
CREATE TABLE IF NOT EXISTS public.contests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  theme TEXT,
  prize_description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'voting', 'finished')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  winner_id UUID REFERENCES public.photos(id) ON DELETE SET NULL
);

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read contests" ON public.contests FOR SELECT USING (true);
CREATE POLICY "Admins can insert contests" ON public.contests FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can update contests" ON public.contests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE TABLE IF NOT EXISTS public.contest_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID REFERENCES public.contests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(contest_id, user_id)
);

ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read entries" ON public.contest_entries FOR SELECT USING (true);
CREATE POLICY "Users can insert own entries" ON public.contest_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.contest_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID REFERENCES public.contests(id) ON DELETE CASCADE NOT NULL,
  entry_id UUID REFERENCES public.contest_entries(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(contest_id, user_id)
);

ALTER TABLE public.contest_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read votes" ON public.contest_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert own votes" ON public.contest_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contest_entries_contest ON public.contest_entries(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_votes_contest ON public.contest_votes(contest_id);

-- Functions
CREATE OR REPLACE FUNCTION public.earn_coins(p_user_id UUID, p_amount INTEGER, p_type TEXT, p_ref TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_coins (user_id, balance) VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = user_coins.balance + p_amount, updated_at = now();
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id) VALUES (p_user_id, p_amount, p_type, p_ref);
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_coins(p_user_id UUID, p_amount INTEGER, p_type TEXT, p_ref TEXT DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  bal INTEGER;
BEGIN
  SELECT balance INTO bal FROM public.user_coins WHERE user_id = p_user_id;
  IF bal IS NULL OR bal < p_amount THEN RETURN false; END IF;
  UPDATE public.user_coins SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_user_id;
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id) VALUES (p_user_id, -p_amount, p_type, p_ref);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id UUID)
RETURNS SETOF TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r_count INTEGER; p_count INTEGER; streak_count INTEGER; f_count INTEGER; avg_sc NUMERIC;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO r_count FROM public.ratings WHERE rater_id = p_user_id;
  SELECT COUNT(*) INTO p_count FROM public.photos WHERE user_id = p_user_id AND status = 'approved';
  SELECT COALESCE(current_streak, 0) INTO streak_count FROM public.user_streaks WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO f_count FROM public.follows WHERE following_id = p_user_id;
  SELECT COALESCE(AVG(r.stars), 0) INTO avg_sc FROM public.photos p JOIN public.ratings r ON r.photo_id = p.id WHERE p.user_id = p_user_id AND p.status = 'approved' HAVING COUNT(DISTINCT p.id) >= 10;

  FOR rec IN SELECT * FROM public.achievements LOOP
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = p_user_id AND achievement_id = rec.id) THEN CONTINUE; END IF;
    IF rec.condition_type = 'ratings_total' AND r_count >= rec.condition_value
      OR rec.condition_type = 'photos_total' AND p_count >= rec.condition_value
      OR rec.condition_type = 'streak_days' AND streak_count >= rec.condition_value
      OR rec.condition_type = 'followers_total' AND f_count >= rec.condition_value
      OR rec.condition_type = 'avg_score' AND avg_sc * 10 >= rec.condition_value
    THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (p_user_id, rec.id);
      RETURN NEXT rec.id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_leaderboard(p_contest_id UUID)
RETURNS TABLE (entry_id UUID, user_id UUID, username TEXT, storage_path TEXT, avg_score NUMERIC, vote_count BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ce.id, ce.user_id, pr.username, ph.storage_path,
    COALESCE(AVG(cv.stars), 0)::NUMERIC AS avg_score,
    COUNT(cv.id) AS vote_count
  FROM public.contest_entries ce
  JOIN public.profiles pr ON pr.id = ce.user_id
  JOIN public.photos ph ON ph.id = ce.photo_id
  LEFT JOIN public.contest_votes cv ON cv.entry_id = ce.id
  WHERE ce.contest_id = p_contest_id
  GROUP BY ce.id, pr.username, ph.storage_path
  ORDER BY avg_score DESC;
$$;

CREATE OR REPLACE FUNCTION public.try_contest_entry(p_user_id UUID, p_contest_id UUID, p_photo_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fee INT; v_balance INT; v_count INT; v_max INT;
BEGIN
  SELECT entry_fee, max_entries INTO v_fee, v_max FROM public.contests WHERE id = p_contest_id;
  SELECT balance INTO v_balance FROM public.user_coins WHERE user_id = p_user_id;
  IF v_fee > 0 AND (v_balance IS NULL OR v_balance < v_fee) THEN RETURN 'insufficient_coins'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.contest_entries WHERE contest_id = p_contest_id;
  IF v_count >= v_max THEN RETURN 'full'; END IF;
  INSERT INTO public.contest_entries (contest_id, user_id, photo_id) VALUES (p_contest_id, p_user_id, p_photo_id);
  IF v_fee > 0 THEN
    UPDATE public.user_coins SET balance = balance - v_fee WHERE user_id = p_user_id;
    INSERT INTO public.coin_transactions (user_id, amount, type) VALUES (p_user_id, -v_fee, 'contest_entry');
  END IF;
  RETURN 'ok';
END;
$$;

-- Add is_admin to profiles if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Insert coins on rating (trigger)
CREATE OR REPLACE FUNCTION public.award_rating_coins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_coins (user_id, balance) VALUES (NEW.rater_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET balance = user_coins.balance + 1, updated_at = now();
  INSERT INTO public.coin_transactions (user_id, amount, type) VALUES (NEW.rater_id, 1, 'earn_rating');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rating_earn_coins ON public.ratings;
CREATE TRIGGER on_rating_earn_coins AFTER INSERT ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.award_rating_coins();
