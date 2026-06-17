-- Add status column to photos (existing rows keep 'approved')
ALTER TABLE public.photos ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
CREATE INDEX idx_photos_status ON public.photos(status);

-- Update get_next_photo RPC to only show approved photos
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
    AND p.status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM public.ratings rr WHERE rr.photo_id = p.id AND rr.rater_id = auth.uid())
    AND (p_category IS NULL OR p.category::text = p_category)
  GROUP BY p.id, pr.username, pr.city
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

-- Update get_leaderboard RPC to only include approved photos
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
  LEFT JOIN public.photos p ON p.user_id = pr.id AND p.status = 'approved' AND (p_category IS NULL OR p.category::text = p_category)
  LEFT JOIN public.ratings r ON r.photo_id = p.id AND r.created_at >= (SELECT ts FROM window_start)
  GROUP BY pr.id, pr.username
  HAVING COUNT(DISTINCT p.id) > 0
  ORDER BY avg_score DESC, rating_count DESC
  LIMIT 100;
$$;

-- Allow admin users to update any photo
CREATE POLICY "photos_admin_update" ON public.photos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
GRANT UPDATE ON public.photos TO authenticated;
