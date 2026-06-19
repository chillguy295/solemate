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
  const { title, body: messageBody, url } = body;

  if (!title) {
    return { error: "Title is required" };
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    console.error("Failed to fetch subscriptions:", error);
    return { error: "Failed to fetch subscriptions" };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, message: "No subscribers" };
  }

  let sent = 0;
  let failed = 0;
  const toRemove: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title,
          body: messageBody || "",
          url: url || "/",
        })
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        toRemove.push(sub.id);
      }
    }
  }

  if (toRemove.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", toRemove);
  }

  return { sent, failed, removed: toRemove.length };
});
