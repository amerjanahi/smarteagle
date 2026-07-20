import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/emergency-contacts")({
  head: () => ({ meta: [{ title: "Emergency Contacts — Hayy Admin" }] }),
  component: EmergencyContactsPage,
});

function EmergencyContactsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", role_label: "", phone: "", priority: 100 });

  const { data = [] } = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("emergency_contacts").select("*").order("priority");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("emergency_contacts").insert(form as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added"); setForm({ name: "", role_label: "", phone: "", priority: 100 }); qc.invalidateQueries({ queryKey: ["emergency-contacts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("emergency_contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emergency-contacts"] }),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Emergency Contacts</h1>
        <p className="text-sm text-muted-foreground">Contacts visible to security staff in the gate portal.</p>
      </header>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Role</Label><Input value={form.role_label} onChange={(e) => setForm({ ...form, role_label: e.target.value })} placeholder="Police, Fire, Manager…" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
          <div className="md:col-span-4">
            <Button onClick={() => save.mutate()} disabled={!form.name || !form.phone || save.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {data.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{c.name} <span className="text-xs text-muted-foreground">· priority {c.priority}</span></div>
                <div className="text-xs text-muted-foreground">{c.role_label ?? ""}</div>
                <div className="text-sm">{c.phone}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
