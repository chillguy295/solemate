-- 1. Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_photo ON public.comments(photo_id, created_at DESC);
GRANT SELECT, INSERT ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notify photo owner on comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  photo_owner UUID;
  commenter_name TEXT;
BEGIN
  SELECT user_id INTO photo_owner FROM public.photos WHERE id = NEW.photo_id;
  IF photo_owner IS NULL OR photo_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT username INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (photo_owner, 'comment', 'New comment!',
    commenter_name || ' commented on your photo',
    '/rate');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_inserted
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- 2. Follows
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX idx_follows_following ON public.follows(following_id);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_read_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Notify on follow
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT username INTO follower_name FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.following_id, 'follow', 'New follower!',
    follower_name || ' started following you',
    '/rate');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follow_inserted
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- 3. Update get_next_photo to also return caption
DROP FUNCTION IF EXISTS public.get_next_photo(text) CASCADE;
CREATE FUNCTION public.get_next_photo(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, user_id UUID, category photo_category, storage_path TEXT,
  username TEXT, city TEXT, caption TEXT, avg_score NUMERIC, rating_count BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.user_id, p.category, p.storage_path,
    pr.username, pr.city, p.caption,
    COALESCE(AVG(r.stars), 0)::NUMERIC AS avg_score,
    COUNT(r.id) AS rating_count
  FROM public.photos p
  JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.ratings r ON r.photo_id = p.id
  WHERE p.user_id <> auth.uid()
    AND p.status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM public.ratings rr WHERE rr.photo_id = p.id AND rr.rater_id = auth.uid())
    AND (p_category IS NULL OR p.category::text = p_category)
  GROUP BY p.id, pr.username, pr.city, p.caption
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;
