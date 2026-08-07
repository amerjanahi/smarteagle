import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Clock3, Mail, MessageCircle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Rule = any;

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "in_app", label: "In-app", icon: Bell },
] as const;

const triggerLabel: Record<string, string> = {
  on_issue: "When invoice is issued",
  before_due: "Before due date",
  on_due: "On due date",
  after_due: "After due date",
};

function timing(rule: Rule) {
  if (rule.trigger_kind === "on_issue") return "Immediately when issued";
  if (rule.trigger_kind === "on_due") return "On the due date";
  return `${rule.offset_days} day${rule.offset_days === 1 ? "" : "s"} ${rule.trigger_kind === "before_due" ? "before" : "after"} due date`;
}

export function InvoiceReminderSettings() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Rule | null>(null);
  const rules = useQuery({
    queryKey: ["invoice-reminder-rules"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("invoice_reminder_rules" as any) as any).select("*").order("trigger_kind").order("offset_days");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });
  const reminders = useQuery({
    queryKey: ["invoice-reminder-queue"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("invoice_reminders" as any) as any)
        .select("id, scheduled_for, status, channels, recipient_email, invoices(invoice_number, due_date)")
        .order("scheduled_for", { ascending: true }).limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = useMemo(() => rules.data?.find((rule) => rule.id === selectedId) ?? rules.data?.[0] ?? null, [rules.data, selectedId]);
  useEffect(() => { if (selected) setDraft({ ...selected, channels: [...selected.channels] }); }, [selected]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const { error } = await (supabase.from("invoice_reminder_rules" as any) as any)
        .update({
          name: draft.name, trigger_kind: draft.trigger_kind, offset_days: Number(draft.offset_days), channels: draft.channels,
          email_subject_template: draft.email_subject_template, email_body_template: draft.email_body_template,
          whatsapp_template: draft.whatsapp_template, language: draft.language, send_time: draft.send_time, enabled: draft.enabled,
        }).eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reminder rule saved"); qc.invalidateQueries({ queryKey: ["invoice-reminder-rules"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleChannel = (channel: string) => {
    if (!draft) return;
    const exists = draft.channels.includes(channel);
    setDraft({ ...draft, channels: exists ? draft.channels.filter((item: string) => item !== channel) : [...draft.channels, channel] });
  };

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><p className="font-medium">Automatic invoice reminder cycle</p><p className="mt-1 text-muted-foreground">Every new invoice receives this schedule. Paid or cancelled invoices automatically stop any remaining reminders. Email and WhatsApp delivery will be connected in Step 2; the queue is ready now.</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card><CardContent className="space-y-2 p-3">
          <p className="px-1 text-sm font-semibold">Reminder cycle</p>
          {(rules.data ?? []).map((rule) => (
            <button key={rule.id} onClick={() => setSelectedId(rule.id)} className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === rule.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{rule.name}</span><Badge variant={rule.enabled ? "default" : "secondary"}>{rule.enabled ? "On" : "Off"}</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">{timing(rule)}</p>
            </button>
          ))}
          {!rules.data?.length && <p className="p-3 text-sm text-muted-foreground">Reminder rules will appear after the database update is applied.</p>}
        </CardContent></Card>

        {draft && <Card><CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold">{draft.name}</h4><p className="text-sm text-muted-foreground">Controls the schedule and message format for this reminder.</p></div><div className="flex items-center gap-2 text-sm"><span>Enabled</span><Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} /></div></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Trigger</Label><Select value={draft.trigger_kind} onValueChange={(trigger_kind) => setDraft({ ...draft, trigger_kind })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(triggerLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Days</Label><Input type="number" min="0" max="365" disabled={draft.trigger_kind === "on_issue" || draft.trigger_kind === "on_due"} value={draft.offset_days} onChange={(event) => setDraft({ ...draft, offset_days: event.target.value })} /></div>
            <div><Label>Send time</Label><Input type="time" value={draft.send_time?.slice(0, 5) ?? "09:00"} onChange={(event) => setDraft({ ...draft, send_time: event.target.value })} /></div>
          </div>
          <div><Label>Channels</Label><div className="mt-2 flex flex-wrap gap-2">{CHANNELS.map((channel) => { const Icon = channel.icon; const active = draft.channels.includes(channel.value); return <Button key={channel.value} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => toggleChannel(channel.value)}><Icon className="mr-1.5 h-4 w-4" />{channel.label}</Button>; })}</div><p className="mt-2 text-xs text-muted-foreground">WhatsApp is only queued for residents who have opted in and supplied a WhatsApp number.</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2"><Label>Email subject</Label><Input value={draft.email_subject_template} onChange={(event) => setDraft({ ...draft, email_subject_template: event.target.value })} /><Label>Email message</Label><Textarea rows={7} value={draft.email_body_template} onChange={(event) => setDraft({ ...draft, email_body_template: event.target.value })} /></div>
            <div className="space-y-2"><Label>WhatsApp message</Label><Textarea rows={7} value={draft.whatsapp_template} onChange={(event) => setDraft({ ...draft, whatsapp_template: event.target.value })} /><Label>Language</Label><Select value={draft.language} onValueChange={(language) => setDraft({ ...draft, language })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">Arabic</SelectItem><SelectItem value="bilingual">English + Arabic</SelectItem></SelectContent></Select></div>
          </div>
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Available fields: <code>{"{{customer_name}}"}</code>, <code>{"{{unit_number}}"}</code>, <code>{"{{invoice_number}}"}</code>, <code>{"{{invoice_total}}"}</code>, <code>{"{{balance_due}}"}</code>, <code>{"{{due_date}}"}</code>, <code>{"{{payment_link}}"}</code>.</p>
          <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending || !draft.channels.length}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save reminder rule"}</Button></div>
        </CardContent></Card>}
      </div>

      <Card><CardContent className="p-4"><div className="mb-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><h4 className="font-semibold">Upcoming reminder queue</h4></div><div className="space-y-2">{(reminders.data ?? []).map((reminder: any) => <div key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-medium">{reminder.invoices?.invoice_number ?? "Invoice"} <span className="font-normal text-muted-foreground">→ {reminder.recipient_email ?? "In-app recipient"}</span></p><p className="text-xs text-muted-foreground">Scheduled {new Date(reminder.scheduled_for).toLocaleString()} · {reminder.channels.join(", ")}</p></div><Badge variant={reminder.status === "scheduled" ? "secondary" : "default"}>{reminder.status}</Badge></div>)}{!reminders.data?.length && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-5 w-5" />No reminders are queued yet. New invoices will create them automatically.</div>}</div></CardContent></Card>
    </div>
  );
}
