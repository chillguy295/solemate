import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { PhotoImage } from "@/components/photo-image";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

type Report = {
  id: string;
  photo_id: string;
  reporter_id: string;
  reporter_username: string | null;
  reason: string;
  created_at: string;
  photo_storage_path: string | null;
  photo_username: string | null;
};

function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("photo_reports")
        .select("id, photo_id, reporter_id, reason, created_at, photos(storage_path)")
        .order("created_at", { ascending: false });
      const mapped: Report[] = (data ?? []).map((r: any) => ({
        id: r.id,
        photo_id: r.photo_id,
        reporter_id: r.reporter_id,
        reason: r.reason,
        created_at: r.created_at,
        photo_storage_path: r.photos?.storage_path ?? null,
        photo_username: null,
        reporter_username: null,
      }));
      for (const report of mapped) {
        const [p, rep] = await Promise.all([
          supabase.from("photos").select("user_id").eq("id", report.photo_id).single(),
          supabase.from("profiles").select("username").eq("id", report.reporter_id).maybeSingle(),
        ]);
        report.reporter_username = (rep.data as any)?.username ?? null;
        if (p.data) {
          const owner = await supabase.from("profiles").select("username").eq("id", (p.data as any).user_id).single();
          report.photo_username = (owner.data as any)?.username ?? null;
        }
      }
      setReports(mapped);
      setLoading(false);
    })();
  }, []);

  async function dismissReport(reportId: string) {
    const { error } = await supabase.from("photo_reports").delete().eq("id", reportId);
    if (error) return toast.error(error.message);
    toast.success("Report dismissed");
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  async function deletePhotoAndDismiss(photoId: string, reportId: string) {
    setBusy(reportId);
    const { error } = await supabase.from("photos").delete().eq("id", photoId);
    if (error) { toast.error(error.message); setBusy(null); return; }
    await supabase.from("photo_reports").delete().eq("id", reportId);
    toast.success("Photo deleted and report dismissed");
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="px-5 pt-5 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="px-5 pt-16 text-center animate-pop-in">
        <div className="text-5xl mb-3">🚩</div>
        <h3 className="text-lg font-heading font-semibold">No reports</h3>
        <p className="text-sm text-muted-foreground mt-1">No photos have been reported.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden animate-pop-in">
          <div className="flex gap-3 p-3">
            {r.photo_storage_path && (
              <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
                <PhotoImage path={r.photo_storage_path} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-heading font-semibold text-sm truncate">@{r.photo_username ?? "unknown"}</div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px] rounded-full">Reported by @{r.reporter_username ?? "unknown"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 italic">&ldquo;{r.reason}&rdquo;</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex border-t border-border/60">
            <button onClick={() => dismissReport(r.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition rounded-bl-2xl">
              <X className="size-4" /> Dismiss
            </button>
            <div className="w-px bg-border/40" />
            <button onClick={() => deletePhotoAndDismiss(r.photo_id, r.id)} disabled={busy === r.id}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/50 transition disabled:opacity-50 rounded-br-2xl">
              <Trash2 className="size-4" /> Delete photo
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
