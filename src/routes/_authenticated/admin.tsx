import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Eye, Flag, Trash2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PhotoImage } from "@/components/photo-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type PendingPhoto = {
  id: string;
  storage_path: string;
  category: string;
  username: string;
  created_at: string;
};

type Report = {
  id: string;
  photo_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
  photo_storage_path: string | null;
  photo_username: string | null;
  reporter_username: string | null;
};

type Tab = "photos" | "reports";

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("photos");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth", replace: true }); return; }
      const { data: role } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (!role) { setIsAdmin(false); setLoading(false); return; }
      setIsAdmin(true);
      await loadPhotos();
      await loadReports();
      setLoading(false);
    })();
  }, [navigate]);

  async function loadPhotos() {
    const { data } = await supabase
      .from("photos")
      .select("id, storage_path, category, created_at, profiles!inner(username)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPhotos((data ?? []).map((r: any) => ({
      id: r.id,
      storage_path: r.storage_path,
      category: r.category,
      username: r.profiles.username,
      created_at: r.created_at,
    })));
  }

  async function loadReports() {
    const { data } = await supabase
      .from("photo_reports")
      .select("id, photo_id, reporter_id, reason, created_at, photos!inner(storage_path), profiles!reporter_id(username)")
      .order("created_at", { ascending: false });
    const mapped: Report[] = (data ?? []).map((r: any) => ({
      id: r.id,
      photo_id: r.photo_id,
      reporter_id: r.reporter_id,
      reason: r.reason,
      created_at: r.created_at,
      photo_storage_path: r.photos?.storage_path ?? null,
      photo_username: null,
      reporter_username: r.profiles?.username ?? null,
    }));
    for (const report of mapped) {
      const { data: p } = await supabase
        .from("photos")
        .select("profiles!inner(username)")
        .eq("id", report.photo_id)
        .single();
      report.photo_username = (p as any)?.profiles?.username ?? null;
    }
    setReports(mapped);
  }

  async function updateStatus(photoId: string, status: string) {
    setBusy(photoId);
    try {
      const { error } = await supabase.from("photos").update({ status }).eq("id", photoId);
      if (error) throw error;
      toast.success(status === "approved" ? "Photo approved" : "Photo rejected");
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setBusy(null);
    }
  }

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
      <AppShell>
        <PageHeader title="Admin" />
        <div className="px-5 pt-5 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 dark:from-primary/10 dark:to-accent/10 animate-pulse" />)}
        </div>
      </AppShell>
    );
  }

  if (isAdmin === false) {
    return (
      <AppShell>
        <PageHeader title="Admin" />
        <div className="px-5 pt-20 text-center animate-pop-in">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-lg font-heading font-semibold">Access denied</h2>
          <p className="text-sm text-muted-foreground mt-1">You need admin privileges to view this page.</p>
        </div>
      </AppShell>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "photos", label: "Photos", count: photos.length },
    { key: "reports", label: "Reports", count: reports.length },
  ];

  return (
    <AppShell>
      <PageHeader title="Admin" subtitle={tab === "photos" ? "Moderation queue" : "Reported photos"} />
      <div className="px-5 pt-4">
        <div className="flex gap-1 p-1 bg-muted dark:bg-muted/50 rounded-lg mb-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${
                tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.key === "photos" ? <Eye className="size-4" /> : <Flag className="size-4" />}
              {t.label}
              {t.count > 0 && <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-1.5">{t.count}</span>}
            </button>
          ))}
        </div>

        {tab === "photos" && (
          <div className="space-y-3">
            {photos.length === 0 ? (
              <div className="text-center py-16 animate-pop-in">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-lg font-heading font-semibold">All caught up</h3>
                <p className="text-sm text-muted-foreground mt-1">No photos pending review.</p>
              </div>
            ) : (
              photos.map((p) => (
                <div key={p.id} className="rounded-2xl bg-white dark:bg-card border border-border/60 shadow-card overflow-hidden animate-pop-in">
                  <div className="flex gap-3 p-3">
                    <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
                      <PhotoImage path={p.storage_path} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-semibold text-sm truncate">@{p.username}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px] rounded-full">{p.category.replace("_", " ")}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex border-t border-border/60">
                    <button onClick={() => updateStatus(p.id, "rejected")} disabled={busy === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/50 transition disabled:opacity-50 rounded-bl-2xl">
                      <X className="size-4" /> Reject
                    </button>
                    <div className="w-px bg-border/40" />
                    <button onClick={() => updateStatus(p.id, "approved")} disabled={busy === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/50 transition disabled:opacity-50 rounded-br-2xl">
                      <Check className="size-4" /> Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="text-center py-16 animate-pop-in">
                <div className="text-5xl mb-3">🚩</div>
                <h3 className="text-lg font-heading font-semibold">No reports</h3>
                <p className="text-sm text-muted-foreground mt-1">No photos have been reported.</p>
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="rounded-2xl bg-white dark:bg-card border border-border/60 shadow-card overflow-hidden animate-pop-in">
                  <div className="flex gap-3 p-3">
                    {r.photo_storage_path && (
                      <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
                        <PhotoImage path={r.photo_storage_path} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-semibold text-sm truncate">@{r.photo_username ?? "unknown"}</div>
                      <div className="flex items-center gap-1.5 mt-1">
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
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
