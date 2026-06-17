import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/maintenance")({
  head: () => ({ meta: [{ title: "Repairs — Hayy" }] }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "plumbing", priority: "medium" });

  const { data: requests } = useQuery({
    queryKey: ["portal-maintenance", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq("submitted_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: residents } = await supabase
        .from("residents").select("unit_id").eq("user_id", user!.id).limit(1);
      const unit_id = residents?.[0]?.unit_id ?? null;
      const { error } = await supabase.from("maintenance_requests").insert({
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority as never,
        submitted_by: user!.id,
        unit_id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request submitted");
      setOpen(false);
      setForm({ title: "", description: "", category: "plumbing", priority: "medium" });
      qc.invalidateQueries({ queryKey: ["portal-maintenance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Repairs</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New maintenance request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="ac">AC</SelectItem>
                      <SelectItem value="appliance">Appliance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending} className="w-full">
                Submit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {(requests?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Wrench className="mx-auto mb-2 h-6 w-6" />
          No requests yet
        </div>
      )}

      <ul className="space-y-2">
        {requests?.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.category} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <Badge variant="outline">{r.status}</Badge>
            </div>
            {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
