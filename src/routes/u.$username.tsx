import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PhotoImage } from "@/components/photo-image";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/u/$username")({
  ssr: false,
  component: PublicProfile,
});

type Profile = { id: string; username: string; bio: string | null; city: string | null; is_pro: boolean; created_at: string };

function PublicProfile() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<{ id: string; storage_path: string; avg: number }[]>([]);
  const [stats, setStats] = useState({ avg: 0, photoCount: 0, received: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p as Profile);
      const [{ data: ph }, { data: s }] = await Promise.all([
        supabase.from("photos").select("id, storage_path, ratings(stars)").eq("user_id", p.id).eq("status", "approved").order("created_at", { ascending: false }),
        supabase.rpc("get_user_stats", { p_user_id: p.id }),
      ]);
      setPhotos((ph ?? []).map((row: any) => {
        const ratings = row.ratings ?? [];
        const avg = ratings.length ? ratings.reduce((a: number, r: any) => a + r.stars, 0) / ratings.length : 0;
        return { id: row.id, storage_path: row.storage_path, avg };
      }));
      const st = s?.[0];
      if (st) setStats({ avg: Number(st.avg_score), photoCount: Number(st.photo_count), received: Number(st.ratings_received) });
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <AppShell hideNav><div className="p-8 text-center text-muted-foreground">Loading…</div></AppShell>;
  if (!profile) return <AppShell hideNav><div className="p-8 text-center text-muted-foreground">User not found.</div></AppShell>;

  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <AppShell hideNav>
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/leaderboard" })} className="text-muted-foreground"><ArrowLeft className="size-5" /></button>
        <h1 className="font-semibold">@{profile.username}</h1>
      </div>
      <div className="px-5 pt-5 flex flex-col items-center text-center">
        <div className="size-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">{initials}</div>
        <h2 className="mt-3 text-xl font-bold">@{profile.username} {profile.is_pro && <span className="text-xs bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-0.5 rounded-full">PRO</span>}</h2>
        {profile.city && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="size-3" />{profile.city}</div>}
        {profile.bio && <p className="text-sm mt-2 max-w-xs">{profile.bio}</p>}
      </div>
      <div className="px-5 mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card border p-3 text-center shadow-card"><div className="text-lg font-bold">{stats.avg.toFixed(2)}</div><div className="text-[10px] uppercase text-muted-foreground">Avg</div></div>
        <div className="rounded-xl bg-card border p-3 text-center shadow-card"><div className="text-lg font-bold">{stats.photoCount}</div><div className="text-[10px] uppercase text-muted-foreground">Photos</div></div>
        <div className="rounded-xl bg-card border p-3 text-center shadow-card"><div className="text-lg font-bold">{stats.received}</div><div className="text-[10px] uppercase text-muted-foreground">Ratings</div></div>
      </div>
      <div className="px-5 mt-5 grid grid-cols-3 gap-1.5 pb-8">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
            <PhotoImage path={p.storage_path} className="w-full h-full object-cover" />
            {p.avg > 0 && <div className="absolute bottom-1 left-1 text-[10px] font-semibold bg-black/60 text-white rounded px-1.5 py-0.5">⭐ {p.avg.toFixed(1)}</div>}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
