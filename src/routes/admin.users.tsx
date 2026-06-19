import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Shield, ShieldOff, Camera, Star, Coins, Crown, Trophy, X, Medal, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhotoImage } from "@/components/photo-image";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type AdminUser = {
  user_id: string; username: string; bio: string | null; city: string | null;
  is_pro: boolean; role: string; photo_count: number; ratings_received: number; created_at: string;
};

type UserDetail = {
  coin_balance: number;
  photos: { id: string; storage_path: string; status: string; category: string; created_at: string; avg_rating?: number }[];
  achievements: { id: string; name: string; icon: string; unlocked_at: string }[];
  ratings_given: number;
};

function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filtered, setFiltered] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_admin_users");
      if (error) { toast.error(error.message); setLoading(false); return; }
      const list = (data ?? []) as AdminUser[];
      setUsers(list);
      setFiltered(list);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(users.filter((u) => u.username.toLowerCase().includes(q) || (u.bio && u.bio.toLowerCase().includes(q))));
  }, [search, users]);

  async function toggleAdmin(userId: string, currentRole: string) {
    setToggling(userId);
    const isAdmin = currentRole === "admin";
    try {
      if (isAdmin) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
        toast.success("Admin role removed");
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
        toast.success("Admin role granted");
      }
      const { data } = await supabase.rpc("get_admin_users");
      const list = (data ?? []) as AdminUser[];
      setUsers(list);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update role");
    } finally {
      setToggling(null);
    }
  }

  async function openDetail(u: AdminUser) {
    setSelected(u);
    setDetail(null);
    setDetailLoading(true);

    const [{ data: coins }, { data: photos }, { data: achievements }, { data: ratingsGiven }] = await Promise.all([
      supabase.from("user_coins").select("balance").eq("user_id", u.user_id).maybeSingle(),
      supabase.from("photos").select("id, storage_path, status, category, created_at").eq("user_id", u.user_id).order("created_at", { ascending: false }).limit(20),
      supabase.from("user_achievements").select("achievement_id, unlocked_at, achievements!inner(name, icon)").eq("user_id", u.user_id),
      supabase.from("ratings").select("id", { count: "exact", head: true }).eq("rater_id", u.user_id),
    ]);

    const photoIds = (photos ?? []).map((p) => p.id);
    const avgMap: Record<string, number> = {};
    if (photoIds.length > 0) {
      const { data: ratings } = await supabase
        .from("ratings")
        .select("photo_id, rating")
        .in("photo_id", photoIds);
      const sums: Record<string, { sum: number; count: number }> = {};
      (ratings ?? []).forEach((r: any) => {
        if (!sums[r.photo_id]) sums[r.photo_id] = { sum: 0, count: 0 };
        sums[r.photo_id].sum += r.rating;
        sums[r.photo_id].count++;
      });
      Object.entries(sums).forEach(([pid, s]) => { avgMap[pid] = Math.round((s.sum / s.count) * 10) / 10; });
    }

    setDetail({
      coin_balance: (coins as any)?.balance ?? 0,
      photos: (photos ?? []).map((p) => ({ ...p, avg_rating: avgMap[p.id] })),
      achievements: (achievements ?? []).map((a: any) => ({
        id: a.achievement_id,
        name: a.achievements.name,
        icon: a.achievements.icon,
        unlocked_at: a.unlocked_at,
      })),
      ratings_given: ratingsGiven ?? 0,
    });
    setDetailLoading(false);
  }

  if (loading) {
    return (
      <div className="px-5 pt-5 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 space-y-2 pb-8">
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by username..." className="w-full rounded-xl border border-border/60 bg-transparent pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">No users found.</div>
      ) : (
        filtered.map((u) => (
          <div key={u.user_id} className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden animate-pop-in">
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => openDetail(u)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading font-semibold text-sm truncate">@{u.username}</span>
                    {u.is_pro && <Crown className="size-3 text-amber-500 shrink-0" />}
                    {u.role === "admin" && <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0">Admin</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span className="inline-flex items-center gap-0.5"><Camera className="size-3" /> {u.photo_count}</span>
                    <span className="inline-flex items-center gap-0.5"><Star className="size-3" /> {u.ratings_received}</span>
                    {u.city && <span>📍{u.city}</span>}
                  </div>
                </button>
                <div className="flex items-center gap-1.5">
                  {u.bio && <div className="hidden sm:block text-[10px] text-muted-foreground max-w-[120px] truncate">{u.bio}</div>}
                  <button onClick={() => toggleAdmin(u.user_id, u.role)} disabled={toggling === u.user_id}
                    className={cn("shrink-0 size-8 rounded-xl flex items-center justify-center transition-colors", u.role === "admin" ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                    aria-label={u.role === "admin" ? "Remove admin" : "Make admin"}>
                    {u.role === "admin" ? <Shield className="size-4" /> : <ShieldOff className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) { setSelected(null); setDetail(null); } }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <span>@{selected?.username}</span>
              {selected?.is_pro && <Crown className="size-4 text-amber-500" />}
              {selected?.role === "admin" && <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0">Admin</Badge>}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {selected?.bio && <p className="text-xs text-muted-foreground">{selected.bio}</p>}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-3 text-center">
                  <Coins className="size-4 mx-auto text-emerald-500" />
                  <p className="text-lg font-bold font-heading tabular-nums mt-1">{detail.coin_balance}</p>
                  <p className="text-[10px] text-muted-foreground">Coins</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-3 text-center">
                  <Star className="size-4 mx-auto text-blue-500" />
                  <p className="text-lg font-bold font-heading tabular-nums mt-1">{selected?.ratings_received}</p>
                  <p className="text-[10px] text-muted-foreground">Received</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 p-3 text-center">
                  <Award className="size-4 mx-auto text-violet-500" />
                  <p className="text-lg font-bold font-heading tabular-nums mt-1">{detail.ratings_given}</p>
                  <p className="text-[10px] text-muted-foreground">Given</p>
                </div>
              </div>

              {detail.achievements.length > 0 && (
                <div>
                  <h4 className="text-xs font-heading font-semibold flex items-center gap-1 mb-2"><Medal className="size-3.5 text-amber-500" /> Achievements</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.achievements.map((a) => (
                      <Badge key={a.id} variant="secondary" className="text-[10px] rounded-full">{a.icon} {a.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-heading font-semibold flex items-center gap-1 mb-2"><Camera className="size-3.5 text-primary" /> Photos ({detail.photos.length})</h4>
                {detail.photos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No photos yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {detail.photos.map((p) => (
                      <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 border border-border/40 group">
                        <PhotoImage path={p.storage_path} className="w-full h-full object-cover" />
                        <div className="absolute top-0.5 right-0.5">
                          <Badge className={cn(
                            "text-[7px] px-1 py-0 border-0",
                            p.status === "approved" ? "bg-green-500/80 text-white" :
                            p.status === "pending" ? "bg-amber-500/80 text-white" : "bg-red-500/80 text-white"
                          )}>{p.status}</Badge>
                        </div>
                        {p.avg_rating && <div className="absolute bottom-0.5 left-0.5 text-[9px] text-white font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">★{p.avg_rating}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
