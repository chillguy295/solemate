import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Send, Bell, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/push")({
  component: AdminPush,
});

function AdminPush() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; removed: number } | null>(null);

  async function send() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || "/" }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setResult(data);
      toast.success(`Sent to ${data.sent} device(s)`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-5 pt-5 space-y-4 pb-8">
      <div className="rounded-2xl border border-border/50 shadow-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Bell className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-heading font-semibold">Send push notification</h3>
            <p className="text-[11px] text-muted-foreground">Broadcast to all users with push enabled</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New update!" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Check out the latest contest..." rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Deep link</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/contests" className="mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Where the notification opens (e.g. /contests, /profile)</p>
          </div>

          <Button onClick={send} disabled={sending} className="w-full mt-2">
            {sending ? (
              <>Sending...</>
            ) : (
              <><Send className="size-4 mr-1.5" /> Send notification</>
            )}
          </Button>
        </div>

        {result && (
          <div className="mt-4 rounded-xl bg-muted/50 p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="size-2 rounded-full bg-green-500" />
              <span className="font-medium">Sent: {result.sent}</span>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="size-2 rounded-full bg-red-500" />
                <span className="font-medium">Failed: {result.failed}</span>
              </div>
            )}
            {result.removed > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-muted-foreground/40" />
                <span>Stale subscriptions removed: {result.removed}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 shadow-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="size-4 text-muted-foreground" />
          <h4 className="text-xs font-heading font-semibold">Tips</h4>
        </div>
        <ul className="text-[11px] text-muted-foreground space-y-1 ml-5 list-disc">
          <li>Keep title short and punchy (under 50 chars)</li>
          <li>Body should be 1-2 sentences max</li>
          <li>Deep links can be: /rate, /contests, /profile, /notifications</li>
          <li>Only users who granted notification permission will receive it</li>
        </ul>
      </div>
    </div>
  );
}
