import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerWalkIn } from "@/lib/gate.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { t, getLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate/checkin")({
  head: () => ({ meta: [{ title: "Walk-in — Security Portal" }] }),
  component: WalkInPage,
});

function WalkInPage() {
  const lang = getLang();
  const nav = useNavigate();
  const [visitorName, setName] = useState("");
  const [visitorPhone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [type, setType] = useState<"guest" | "delivery" | "contractor">("guest");
  const [company, setCompany] = useState("");
  const [unitQuery, setUnitQuery] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const register = useServerFn(registerWalkIn);

  const { data: units = [] } = useQuery({
    queryKey: ["gate-unit-search", unitQuery],
    queryFn: async () => {
      if (!unitQuery) return [];
      const { data } = await supabase.from("units")
        .select("id, unit_number, building")
        .ilike("unit_number", `%${unitQuery}%`).limit(8);
      return data ?? [];
    },
  });

  const sess = typeof window !== "undefined" ? sessionStorage.getItem("gate_session_id") ?? "" : "";
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "";

  async function submit() {
    if (!visitorName.trim()) return;
    setBusy(true);
    try {
      await register({ data: {
        visitorName, visitorPhone, plate, purpose, visitorType: type, company,
        unitId, notes, deviceInfo: device, sessionId: sess,
      }});
      toast.success(t("saved", lang));
      nav({ to: "/gate/approved" });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("visitor_name", lang)}</Label>
        <Input value={visitorName} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>{t("phone", lang)}</Label>
          <Input value={visitorPhone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div>
          <Label>{t("plate", lang)}</Label>
          <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} />
        </div>
      </div>
      <div>
        <Label>{t("type", lang)}</Label>
        <Select value={type} onValueChange={(v: any) => setType(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="guest">{t("guest", lang)}</SelectItem>
            <SelectItem value="delivery">{t("delivery", lang)}</SelectItem>
            <SelectItem value="contractor">{t("contractor", lang)}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(type === "delivery" || type === "contractor") && (
        <div>
          <Label>{t("company", lang)}</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
      )}
      <div>
        <Label>{t("unit", lang)}</Label>
        <Input value={unitQuery} onChange={(e) => { setUnitQuery(e.target.value); setUnitId(null); }} placeholder="Villa number" />
        {units.length > 0 && !unitId && (
          <div className="mt-1 rounded-md border border-border bg-card">
            {units.map((u: any) => (
              <button key={u.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => { setUnitId(u.id); setUnitQuery(u.unit_number); }}>
                {u.unit_number} {u.building ? `· ${u.building}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label>{t("purpose", lang)}</Label>
        <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
      <div>
        <Label>{t("gate_notes", lang)}</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button className="w-full" onClick={submit} disabled={busy || !visitorName.trim()}>
        {t("register_entry", lang)}
      </Button>
    </div>
  );
}
