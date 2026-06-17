import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { navigate({ to: "/auth", replace: true }); return; }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifs((data ?? []) as Notification[]);
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase.rpc("mark_notification_read", { p_notification_id: id });
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const ids = notifs.filter((n) => !n.read).map((n) => n.id);
    await Promise.all(ids.map((id) => supabase.rpc("mark_notification_read", { p_notification_id: id })));
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All marked read");
  }

  useEffect(() => { load(); }, []);

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        right={
          unread > 0 ? (
            <button onClick={markAllRead} className="text-xs text-primary font-heading font-medium hover:underline">Mark all read</button>
          ) : undefined
        }
      />
      <div className="px-5 pt-4 space-y-2">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 animate-pulse" />)
        ) : notifs.length === 0 ? (
          <div className="text-center py-16 animate-pop-in">
            <Bell className="size-10 mx-auto text-muted-foreground/40" />
            <h3 className="mt-3 text-lg font-heading font-semibold">No notifications yet</h3>
            <p className="text-sm text-muted-foreground mt-1">When someone rates your photo, you&apos;ll see it here.</p>
          </div>
        ) : (
          notifs.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`w-full text-left rounded-2xl p-4 border transition-all ${n.read ? "bg-white dark:bg-card border-border/40" : "bg-primary/5 border-primary/20 shadow-sm"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-sm">{n.title}</div>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.read && <span className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
            </button>
          ))
        )}
      </div>
    </AppShell>
  );
}
