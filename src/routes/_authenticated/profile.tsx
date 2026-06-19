import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Camera, LogOut, Sparkles, Pencil, Trash2, Sun, Moon, Coins, Trophy, Share2, Gift, Copy, Users, Check } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PhotoImage } from "@/components/photo-image";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Category } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const FREE_UPLOAD_CAP = 5;

type Profile = { id: string; username: string; bio: string | null; city: string | null; is_pro: boolean; created_at: string };
type PhotoRow = { id: string; storage_path: string; category: string; avg: number; status?: string };

function ProfilePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [stats, setStats] = useState({ avg: 0, photoCount: 0, given: 0, received: 0 });
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState<Category>("nail_art");
  const [pendingCaption, setPendingCaption] = useState("");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editCity, setEditCity] = useState("");
  const [achievements, setAchievements] = useState<{ id: string; title: string; description: string; icon: string }[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [referralStats, setReferralStats] = useState<{ total_referrals: number; coins_earned: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadAll() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: p }, { data: ph }, { data: s }, { data: st }, { data: ach }, { data: coins }, { data: rf }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("photos").select("id, storage_path, category, status, ratings(stars)").eq("user_id", u.user.id).order("created_at", { ascending: false }),
      supabase.rpc("get_user_stats", { p_user_id: u.user.id }),
      supabase.from("user_streaks").select("current_streak").eq("user_id", u.user.id).maybeSingle(),
      supabase.from("user_achievements").select("achievement_id, achievements!inner(id, title, description, icon)").eq("user_id", u.user.id),
      supabase.from("user_coins").select("balance").eq("user_id", u.user.id).maybeSingle(),
      supabase.rpc("get_referral_stats", { p_user_id: u.user.id }),
    ]);
    setProfile(p as Profile);
    setEditBio(p?.bio ?? ""); setEditCity(p?.city ?? "");
    setPhotos((ph ?? []).map((row: any) => {
      const ratings = row.ratings ?? [];
      const avg = ratings.length ? ratings.reduce((a: number, r: any) => a + r.stars, 0) / ratings.length : 0;
      return { id: row.id, storage_path: row.storage_path, category: row.category, avg, status: row.status };
    }));
    const st0 = s?.[0];
    if (st0) setStats({ avg: Number(st0.avg_score), photoCount: Number(st0.photo_count), given: Number(st0.ratings_given), received: Number(st0.ratings_received) });
    setStreak(st?.current_streak ?? 0);
    setAchievements((ach ?? []).map((a: any) => a.achievements));
    setCoinBalance(coins?.balance ?? 0);
    setReferralStats(rf as { total_referrals: number; coins_earned: number } | null);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function pickFile() {
    if (!profile) return;
    if (!profile.is_pro && stats.photoCount >= FREE_UPLOAD_CAP) {
      toast.error("Free plan limit reached", { description: "Upgrade to Pro for unlimited uploads.", action: { label: "Go Pro", onClick: () => navigate({ to: "/go-pro" }) } });
      return;
    }
    fileRef.current?.click();
  }

  function captureCamera() { cameraRef.current?.click(); }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Max file size: 10MB"); return; }
    setPendingFile(f);
    e.target.value = "";
  }

  async function confirmUpload() {
    if (!pendingFile || !profile) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = pendingFile.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, pendingFile, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("photos").insert({ user_id: u.user.id, category: pendingCategory, storage_path: path, status: "pending", caption: pendingCaption.trim() || null });
      if (insErr) throw insErr;
      toast.success("Photo uploaded!");
      setPendingFile(null);
      setPendingCaption("");
      await loadAll();
      const newAch = await supabase.rpc("check_achievements", { p_user_id: u.user.id });
      if (newAch.data?.length) {
        const { data: details } = await supabase.from("achievements").select("*").in("id", newAch.data);
        (details ?? []).forEach((a: any) => toast.success(`Achievement unlocked: ${a.icon} ${a.title}`, { description: a.description }));
        await loadAll();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ bio: editBio.trim() || null, city: editCity.trim() || null }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setEditing(false);
    loadAll();
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <AppShell>
      <PageHeader title="Profile" right={
        <button onClick={logout} className="text-muted-foreground hover:text-foreground" aria-label="Log out">
          <LogOut className="size-5" />
        </button>
      } />
      <div className="px-5 pt-5">
        {loading || !profile ? (
          <div className="space-y-3 pt-8">
            <div className="size-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse mx-auto" />
            <div className="h-4 bg-muted animate-pulse rounded-full w-1/2 mx-auto" />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="size-20 rounded-full bg-gradient-to-br from-primary to-[oklch(0.75_0.18_15)] text-white flex items-center justify-center text-2xl font-heading font-bold shadow-md">{initials}</div>
              <div className="mt-3 flex items-center gap-2">
                <h2 className="text-xl font-heading font-bold">@{profile.username}</h2>
                {profile.is_pro && <span className="text-xs font-heading font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2.5 py-0.5 rounded-full">PRO</span>}
              </div>
              {profile.city && <p className="text-sm text-muted-foreground">{profile.city}</p>}
              {profile.bio && <p className="text-sm text-foreground mt-2 max-w-xs">{profile.bio}</p>}
              <p className="text-xs text-muted-foreground/60 mt-1">Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
              {streak > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-heading font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">🔥 {streak} day streak</div>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="rounded-full"><Pencil className="size-3.5 mr-1" /> Edit</Button>
                {!profile.is_pro && <Button size="sm" className="rounded-full" asChild><Link to="/go-pro"><Sparkles className="size-3.5 mr-1" /> Go Pro</Link></Button>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-6">
              <StatCard label="Avg rating" value={stats.avg.toFixed(1)} />
              <StatCard label="Photos" value={stats.photoCount} />
              <StatCard label="Ratings given" value={stats.given} />
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <Coins className="size-4" /> {coinBalance} Sole Coins
              </div>
              {achievements.length > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Trophy className="size-4" /> {achievements.length} badges
                </div>
              )}
            </div>

            {achievements.length > 0 && (
              <div className="mt-4">
                <h3 className="font-heading font-semibold text-sm mb-2">Badges</h3>
                <div className="flex flex-wrap gap-2">
                  {achievements.map((a) => (
                    <div key={a.id} className="inline-flex items-center gap-1.5 text-xs bg-primary/5 text-primary px-3 py-1.5 rounded-full" title={a.description}>
                      <span>{a.icon}</span> {a.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-heading font-semibold">Your photos</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={captureCamera} className="rounded-full"><Camera className="size-3.5 mr-1" /> Camera</Button>
                <Button size="sm" onClick={pickFile} className="rounded-full"><Upload className="size-3.5 mr-1" /> Upload</Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileSelected} />
            </div>
            {!profile.is_pro && (
              <p className="text-xs text-muted-foreground mt-1">{stats.photoCount} / {FREE_UPLOAD_CAP} free uploads</p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.length === 0 ? (
                <div className="col-span-3 text-center py-12 border-2 border-dashed border-border/40 rounded-2xl text-sm text-muted-foreground bg-white/50 dark:bg-card/50">
                  <div className="text-3xl mb-2">📸</div>
                  No photos yet. Upload your first!
                </div>
              ) : (
                photos.map((p) => (
                  <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 shadow-sm">
                    <PhotoImage path={p.storage_path} className="w-full h-full object-cover" />
                    {p.status === "pending" && (
                      <div className="absolute top-1.5 left-1.5 text-[10px] font-heading font-semibold bg-amber-400 text-white rounded-full px-2 py-0.5">Pending</div>
                    )}
                    {p.avg > 0 && p.status !== "pending" && (
                      <div className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/50 text-white rounded-full px-2 py-0.5 backdrop-blur">⭐ {p.avg.toFixed(1)}</div>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this photo?")) return;
                        const { error } = await supabase.from("photos").delete().eq("id", p.id);
                        if (error) return toast.error(error.message);
                        toast.success("Photo deleted");
                        loadAll();
                      }}
                      className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={async () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = 600; canvas.height = 400;
                  const ctx = canvas.getContext("2d")!;
                  const isDark = document.documentElement.classList.contains("dark");
                  ctx.fillStyle = isDark ? "#1a1a2e" : "#fdf2f8";
                  ctx.fillRect(0, 0, 600, 400);
                  ctx.fillStyle = isDark ? "#ec4899" : "#ec4899";
                  ctx.font = "bold 48px sans-serif";
                  ctx.textAlign = "center";
                  ctx.fillText("🦶 SoleMate", 300, 80);
                  ctx.fillStyle = isDark ? "#fff" : "#333";
                  ctx.font = "24px sans-serif";
                  ctx.fillText(`@${profile?.username ?? ""}`, 300, 130);
                  ctx.font = "18px sans-serif";
                  ctx.fillStyle = isDark ? "#ccc" : "#666";
                  ctx.fillText(`⭐ ${stats.avg.toFixed(1)} avg · ${stats.photoCount} photos · ${stats.received} ratings`, 300, 170);
                  ctx.fillText(`🔥 ${streak} day streak · ${coinBalance} coins · ${achievements.length} badges`, 300, 200);
                  ctx.fillStyle = isDark ? "#888" : "#999";
                  ctx.font = "14px sans-serif";
                  ctx.fillText("Join me on SoleMate!", 300, 260);
                  canvas.toBlob(async (blob) => {
                    if (!blob) return;
                    try {
                      await navigator.share({ title: "SoleMate Profile", text: `Check out my SoleMate stats!`, files: [new File([blob], "solemate-card.png", { type: "image/png" })] });
                    } catch { /* share cancelled */ }
                  });
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-card border border-border/60 p-4 shadow-card dark:shadow-none text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="size-4" /> Share my profile
              </button>

              {profile && (
                <Link
                  to="/invite"
                  className="flex items-center gap-4 rounded-2xl bg-white dark:bg-card border border-border/60 p-4 shadow-card dark:shadow-none hover:border-primary/30 transition-colors group"
                >
                  <div className="size-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white shrink-0">
                    <Gift className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-sm">Invite friends</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {referralStats
                        ? `${referralStats.total_referrals} joined · ${referralStats.coins_earned} coins earned`
                        : "Get 20 coins per referral"}
                    </p>
                  </div>
                  <Users className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-card border border-border/60 p-4 shadow-card dark:shadow-none">
              <div>
                <h3 className="font-heading font-semibold text-sm">Dark mode</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Switch to a darker theme</p>
              </div>
              <button
                onClick={() => {
                  const next = !dark;
                  setDark(next);
                  document.documentElement.classList.toggle("dark", next);
                  localStorage.setItem("theme", next ? "dark" : "light");
                }}
                className={`size-10 rounded-full flex items-center justify-center transition-all ${dark ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                aria-label="Toggle dark mode"
              >
                {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
              </button>
            </div>
            </div>
          </>
        )}
      </div>

      {/* Upload category picker */}
      <Dialog open={!!pendingFile} onOpenChange={(o) => !o && setPendingFile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Pick a category</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setPendingCategory(c.value)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${pendingCategory === c.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Textarea id="caption" maxLength={280} value={pendingCaption} onChange={(e) => setPendingCaption(e.target.value)} placeholder="Say something about your photo…" className="mt-1.5 rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => { setPendingFile(null); setPendingCaption(""); }}>Cancel</Button>
            <Button className="rounded-full" onClick={confirmUpload} disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit profile */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ec">City</Label>
              <Input id="ec" maxLength={64} value={editCity} onChange={(e) => setEditCity(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label htmlFor="eb">Bio</Label>
              <Textarea id="eb" maxLength={160} value={editBio} onChange={(e) => setEditBio(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>Cancel</Button>
            <Button className="rounded-full" onClick={saveProfile}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-border/60 p-3.5 text-center shadow-card dark:shadow-none">
      <div className="text-xl font-heading font-bold">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</div>
    </div>
  );
}
