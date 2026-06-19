import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Coins, Users, Clock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/contests")({
  component: AdminContests,
});

type Contest = {
  id: string; title: string; description: string; prize_amount: number;
  entry_fee: number; pro_only: boolean; max_entries: number; ends_at: string; created_at: string;
};

function AdminContests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [entries, setEntries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", prize_amount: 0, entry_fee: 0, pro_only: false, max_entries: 100, ends_at: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: cs }, { data: allEntries }] = await Promise.all([
      supabase.from("contests").select("*").order("created_at", { ascending: false }),
      supabase.from("contest_entries").select("contest_id"),
    ]);
    setContests((cs ?? []) as Contest[]);
    const counts: Record<string, number> = {};
    (allEntries ?? []).forEach((e: any) => { counts[e.contest_id] = (counts[e.contest_id] ?? 0) + 1; });
    setEntries(counts);
    setLoading(false);
  }

  async function create() {
    if (!form.title || !form.ends_at) { toast.error("Title and end date required"); return; }
    setCreating(true);
    const { error } = await supabase.from("contests").insert({
      title: form.title,
      description: form.description || null,
      prize_amount: form.prize_amount,
      entry_fee: form.entry_fee,
      pro_only: form.pro_only,
      max_entries: form.max_entries,
      ends_at: new Date(form.ends_at).toISOString(),
    });
    if (error) { toast.error(error.message); setCreating(false); return; }
    toast.success("Contest created!");
    setShowCreate(false);
    setForm({ title: "", description: "", prize_amount: 0, entry_fee: 0, pro_only: false, max_entries: 100, ends_at: "" });
    setCreating(false);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("contests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contest deleted");
    load();
  }

  return (
    <div className="px-5 pt-5 space-y-3">
      <div className="flex justify-between items-center mb-2">
        <div />
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" /> New contest</Button>
      </div>

      {loading ? (
        [1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)
      ) : contests.length === 0 ? (
        <div className="text-center py-16 animate-pop-in">
          <div className="text-5xl mb-3">🏆</div>
          <h3 className="text-lg font-heading font-semibold">No contests yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first contest.</p>
        </div>
      ) : (
        contests.map((c) => {
          const count = entries[c.id] ?? 0;
          const pct = Math.min(100, (count / c.max_entries) * 100);
          const daysLeft = Math.max(0, Math.ceil((new Date(c.ends_at).getTime() - Date.now()) / 86400000));
          return (
            <div key={c.id} className="rounded-2xl bg-card border border-border/60 shadow-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-base">{c.title}</h3>
                  {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                </div>
                <button onClick={() => remove(c.id)} className="size-7 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900 transition-colors shrink-0" aria-label="Delete contest">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1"><Crown className="size-3.5 text-[var(--gold)]" /> ₹{c.prize_amount.toLocaleString()}</span>
                <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {count}/{c.max_entries}</span>
                <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {daysLeft}d left</span>
                {c.entry_fee > 0 && <span className="inline-flex items-center gap-1"><Coins className="size-3.5" /> {c.entry_fee} coins</span>}
                {c.pro_only && <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 text-[10px]">PRO</Badge>}
              </div>
              <Progress value={pct} className="h-1 mt-2" />
            </div>
          );
        })
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">New contest</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Weekly challenge" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Best feet of the week..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prize (₹)</Label>
                <Input type="number" value={form.prize_amount} onChange={(e) => setForm({ ...form, prize_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Entry fee (coins)</Label>
                <Input type="number" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max entries</Label>
                <Input type="number" value={form.max_entries} onChange={(e) => setForm({ ...form, max_entries: Number(e.target.value) })} />
              </div>
              <div>
                <Label>End date</Label>
                <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.pro_only} onCheckedChange={(v) => setForm({ ...form, pro_only: v })} />
              <Label>Pro only</Label>
            </div>
            <Button className="w-full" onClick={create} disabled={creating}>
              {creating ? "Creating..." : "Create contest"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
