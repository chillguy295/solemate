-- 1. Photo captions
ALTER TABLE public.photos ADD COLUMN caption TEXT;

-- 2. Photo reports
CREATE TABLE public.photo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.photo_reports TO authenticated;
GRANT ALL ON public.photo_reports TO service_role;
ALTER TABLE public.photo_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_self" ON public.photo_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_read_admin" ON public.photo_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create notification when someone rates your photo
CREATE OR REPLACE FUNCTION public.notify_on_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  photo_owner UUID;
  rater_name TEXT;
BEGIN
  SELECT user_id INTO photo_owner FROM public.photos WHERE id = NEW.photo_id;
  IF photo_owner IS NULL OR photo_owner = NEW.rater_id THEN RETURN NEW; END IF;
  SELECT username INTO rater_name FROM public.profiles WHERE id = NEW.rater_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (photo_owner, 'rating', 'New rating!',
    rater_name || ' rated your photo ' || NEW.stars || ' stars',
    '/u/' || rater_name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_rating_inserted
AFTER INSERT ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.notify_on_rating();

-- RPC: get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id UUID)
RETURNS INT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INT FROM public.notifications
  WHERE user_id = p_user_id AND NOT read;
$$;

-- RPC: mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.notifications SET read = TRUE WHERE id = p_notification_id AND user_id = auth.uid();
$$;
