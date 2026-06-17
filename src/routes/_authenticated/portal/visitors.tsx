import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/visitors")({
  head: () => ({ meta: [{ title: "Visitors — Hayy" }] }),
  component: VisitorsPage,
});

function VisitorsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ visitor_name: "", visitor_phone: "", expected_at: "", purpose: "" });

  const { data: visitors } = useQuery({
    queryKey: ["portal-visitors", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitors").select("*").eq("requested_by", user!.id)
        .order("expected_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: residents } = await supabase
        .from("residents").select("unit_id").eq("user_id", user!.id).limit(1);
      const unit_id = residents?.[0]?.unit_id ?? null;
      const { error } = await supabase.from("visitors").insert({
        visitor_name: form.visitor_name,
        visitor_phone: form.visitor_phone || null,
        expected_at: form.expected_at,
        purpose: form.purpose || null,
        requested_by: user!.id,
        unit_id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visitor pre-registered");
      setOpen(false);
      setForm({ visitor_name: "", visitor_phone: "", expected_at: "", purpose: "" });
      qc.invalidateQueries({ queryKey: ["portal-visitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Visitors</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Register</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Pre-register a visitor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Visitor name</Label><Input value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.visitor_phone} onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} /></div>
              <div><Label>Expected at</Label><Input type="datetime-local" value={form.expected_at} onChange={(e) => setForm({ ...form, expected_at: e.target.value })} /></div>
              <div><Label>Purpose</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
              <Button onClick={() => create.mutate()} disabled={!form.visitor_name || !form.expected_at || create.isPending} className="w-full">
                Submit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {(visitors?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <UserPlus className="mx-auto mb-2 h-6 w-6" />
          No visitors registered
        </div>
      )}

      <ul className="space-y-2">
        {visitors?.map((v) => (
          <li key={v.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{v.visitor_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(v.expected_at).toLocaleString()}</p>
                {v.purpose && <p className="text-xs text-muted-foreground">{v.purpose}</p>}
              </div>
              <Badge variant="outline">{v.status}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
