import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { reportIncident } from "@/lib/gate.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { t, getLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate/incidents")({
  head: () => ({ meta: [{ title: "Incidents — Security Portal" }] }),
  component: IncidentsPage,
});

function IncidentsPage() {
  const lang = getLang();
  const qc = useQueryClient();
  const report = useServerFn(reportIncident);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("low");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: list = [] } = useQuery({
    queryKey: ["gate-incidents"],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("incident-photos").upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from("incident-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (data?.signedUrl) setPhotos((p) => [...p, data.signedUrl]);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  }

  const sess = typeof window !== "undefined" ? sessionStorage.getItem("gate_session_id") ?? "" : "";
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "";

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await report({ data: { title, description, severity, photoUrls: photos, deviceInfo: device, sessionId: sess } });
      toast.success(t("saved", lang));
      setTitle(""); setDescription(""); setPhotos([]); setSeverity("low");
      qc.invalidateQueries({ queryKey: ["gate-incidents"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">{t("report_incident", lang)}</h2>
          <div>
            <Label>{t("title", lang)}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>{t("description", lang)}</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>{t("severity", lang)}</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("low", lang)}</SelectItem>
                <SelectItem value="medium">{t("medium", lang)}</SelectItem>
                <SelectItem value="high">{t("high", lang)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("photos", lang)}</Label>
            <Input type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            {uploading && <p className="text-xs text-muted-foreground mt-1">{t("loading", lang)}</p>}
            {photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((u, i) => <img key={i} src={u} alt="" className="h-16 w-16 rounded object-cover border" />)}
              </div>
            )}
          </div>
          <Button className="w-full" onClick={submit} disabled={busy || !title.trim()}>{t("submit", lang)}</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {list.map((i: any) => (
          <Card key={i.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{i.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(i.occurred_at).toLocaleString()}</div>
                  {i.description && <div className="mt-1 text-sm">{i.description}</div>}
                </div>
                <Badge variant={i.severity === "high" ? "destructive" : i.severity === "medium" ? "default" : "outline"}>
                  {i.severity}
                </Badge>
              </div>
              {i.photo_urls?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {i.photo_urls.map((u: string, ix: number) => (
                    <img key={ix} src={u} alt="" className="h-14 w-14 rounded object-cover border" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
