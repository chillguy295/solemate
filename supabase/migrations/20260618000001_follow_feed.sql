CREATE OR REPLACE FUNCTION public.get_followed_photos()
RETURNS TABLE (
  id UUID, user_id UUID, category photo_category, storage_path TEXT,
  username TEXT, city TEXT, caption TEXT, avg_score NUMERIC, rating_count BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $func$
  SELECT p.id, p.user_id, p.category, p.storage_path,
    pr.username, pr.city, p.caption,
    COALESCE(AVG(r.stars), 0)::NUMERIC AS avg_score,
    COUNT(r.id) AS rating_count
  FROM public.photos p
  JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.ratings r ON r.photo_id = p.id
  WHERE p.status = 'approved'
    AND p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.ratings rr WHERE rr.photo_id = p.id AND rr.rater_id = auth.uid())
  GROUP BY p.id, pr.username, pr.city, p.caption
  ORDER BY p.created_at DESC
  LIMIT 20;
$func$;

CREATE OR REPLACE FUNCTION public.get_follow_count(p_user_id UUID)
RETURNS TABLE (follower_count BIGINT, following_count BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $func$
  SELECT
    (SELECT COUNT(*) FROM public.follows WHERE following_id = p_user_id) AS follower_count,
    (SELECT COUNT(*) FROM public.follows WHERE follower_id = p_user_id) AS following_count;
$func$;
