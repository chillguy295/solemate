import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Trash2, Grid3X3, List, Search } from "lucide-react";
import { PhotoImage } from "@/components/photo-image";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/photos")({
  component: AdminPhotos,
});

type Photo = {
  id: string;
  storage_path: string;
  category: string;
  username: string;
  status: string;
  created_at: string;
  avg_rating?: number;
  rating_count?: number;
};

function AdminPhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"pending" | "all">("pending");
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, [mode]);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("photos")
      .select("id, storage_path, category, status, created_at, profiles!inner(username)")
      .order("created_at", { ascending: false });

    if (mode === "pending") {
      query = (query as any).eq("status", "pending") as any;
    }

    const { data } = await query;
    const list: Photo[] = (data ?? []).map((r: any) => ({
      id: r.id,
      storage_path: r.storage_path,
      category: r.category,
      username: r.profiles.username,
      status: r.status,
      created_at: r.created_at,
    }));

    if (mode === "all") {
      const ids = list.map((p) => p.id);
      if (ids.length > 0) {
        const { data: ratings } = await supabase
          .from("ratings")
          .select("photo_id, rating")
          .in("photo_id", ids);
        const avgMap: Record<string, { sum: number; count: number }> = {};
        (ratings ?? []).forEach((r: any) => {
          if (!avgMap[r.photo_id]) avgMap[r.photo_id] = { sum: 0, count: 0 };
          avgMap[r.photo_id].sum += r.rating;
          avgMap[r.photo_id].count++;
        });
        list.forEach((p) => {
          const a = avgMap[p.id];
          if (a) {
            p.avg_rating = Math.round((a.sum / a.count) * 10) / 10;
            p.rating_count = a.count;
          }
        });
      }
    }

    setPhotos(list);
    setLoading(false);
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

  async function deletePhoto(photoId: string) {
    if (!confirm("Delete this photo permanently?")) return;
    setBusy(photoId);
    const { error } = await supabase.from("photos").delete().eq("id", photoId);
    if (error) { toast.error(error.message); setBusy(null); return; }
    toast.success("Photo deleted");
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setBusy(null);
  }

  const filtered = search
    ? photos.filter((p) => p.username.toLowerCase().includes(search.toLowerCase()))
    : photos;

  if (loading) {
    return (
      <div className="px-5 pt-5 space-y-3">
        <div className="flex gap-2 mb-2">
          {[1, 2].map((i) => <div key={i} className="h-8 flex-1 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className={view === "grid" ? "grid grid-cols-3 gap-2" : "space-y-3"}>
          {[1, 2, 3].map((i) => <div key={i} className={view === "grid" ? "aspect-square rounded-xl bg-muted animate-pulse" : "h-24 rounded-2xl bg-muted animate-pulse"} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 space-y-3 pb-8">
      <div className="flex items-center gap-2">
        <button onClick={() => setMode("pending")} className={cn("flex-1 py-2 text-xs font-medium rounded-xl border transition-colors", mode === "pending" ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border/60 text-muted-foreground")}>
          Pending {mode === "pending" && `(${photos.length})`}
        </button>
        <button onClick={() => setMode("all")} className={cn("flex-1 py-2 text-xs font-medium rounded-xl border transition-colors", mode === "all" ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border/60 text-muted-foreground")}>
          All photos
        </button>
        <div className="flex bg-muted rounded-xl p-0.5">
          <button onClick={() => setView("list")} className={cn("size-7 rounded-lg flex items-center justify-center", view === "list" ? "bg-card shadow-sm" : "")}>
            <List className="size-3.5" />
          </button>
          <button onClick={() => setView("grid")} className={cn("size-7 rounded-lg flex items-center justify-center", view === "grid" ? "bg-card shadow-sm" : "")}>
            <Grid3X3 className="size-3.5" />
          </button>
        </div>
      </div>

      {mode === "all" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by username..." className="w-full rounded-xl border border-border/60 bg-transparent pl-8 pr-3 py-2 text-xs outline-none focus:border-primary/50 transition-colors" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 animate-pop-in">
          <div className="text-5xl mb-3">{mode === "pending" ? "✅" : "📸"}</div>
          <h3 className="text-lg font-heading font-semibold">{mode === "pending" ? "All caught up" : "No photos"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "pending" ? "No photos pending review." : "No photos match your search."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((p) => (
            <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 border border-border/40 animate-pop-in">
              <PhotoImage path={p.storage_path} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white font-medium truncate">@{p.username}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Badge className="text-[8px] px-1 py-0 bg-white/20 text-white border-0">{categoryLabel(p.category)}</Badge>
                  {p.avg_rating && <span className="text-[9px] text-white/80">★{p.avg_rating}</span>}
                </div>
              </div>
              <button onClick={() => deletePhoto(p.id)} disabled={busy === p.id}
                className="absolute top-1.5 right-1.5 size-6 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <Trash2 className="size-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden animate-pop-in">
              <div className="flex gap-3 p-3">
                <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
                  <PhotoImage path={p.storage_path} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading font-semibold text-sm truncate">@{p.username}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">{categoryLabel(p.category)}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    {p.avg_rating && <span>★ {p.avg_rating} ({p.rating_count})</span>}
                    <Badge className={cn(
                      "text-[9px] px-1.5 py-0 rounded-full border-0",
                      p.status === "approved" ? "bg-green-100 dark:bg-green-900/30 text-green-600" :
                      p.status === "pending" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
                      "bg-red-100 dark:bg-red-900/30 text-red-600"
                    )}>{p.status}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {p.status === "pending" ? (
                <div className="flex border-t border-border/60">
                  <button onClick={() => updateStatus(p.id, "rejected")} disabled={busy === p.id}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/50 transition disabled:opacity-50 rounded-bl-2xl">
                    <X className="size-3.5" /> Reject
                  </button>
                  <div className="w-px bg-border/40" />
                  <button onClick={() => updateStatus(p.id, "approved")} disabled={busy === p.id}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/50 transition disabled:opacity-50 rounded-br-2xl">
                    <Check className="size-3.5" /> Approve
                  </button>
                </div>
              ) : (
                <div className="flex border-t border-border/60">
                  <button onClick={() => deletePhoto(p.id)} disabled={busy === p.id}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/50 transition disabled:opacity-50 rounded-b-2xl">
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
