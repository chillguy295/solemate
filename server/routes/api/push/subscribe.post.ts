import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VITE_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export default eventHandler(async (event) => {
  const body = await readBody(event);
  const { endpoint, p256dh, auth, userId } = body;

  if (!endpoint || !p256dh || !auth || !userId) {
    return { error: "Missing required fields" };
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint" }
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to save subscription:", error);
    return { error: "Failed to save subscription" };
  }

  return { success: true, id: data.id };
});
