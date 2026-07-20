import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "@/components/gate/QrScanner";
import { AlertBanner } from "@/components/gate/AlertBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { checkInVisitor, checkOutVisitor } from "@/lib/gate.functions";
import { t, getLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate/scan")({
  head: () => ({ meta: [{ title: "Scan — Security Portal" }] }),
  component: ScanPage,
});

function ScanPage() {
  const lang = getLang();
  const [manual, setManual] = useState("");
  const [match, setMatch] = useState<any | null>(null);
  const [alert, setAlert] = useState<{ kind: "blocked" | "expired" | "unknown"; msg: string } | null>(null);
  const nav = useNavigate();
  const checkIn = useServerFn(checkInVisitor);
  const checkOut = useServerFn(checkOutVisitor);

  async function resolve(code: string) {
    setAlert(null); setMatch(null);
    const { data } = await supabase.from("visitors")
      .select("*, units(unit_number, building)")
      .or(`qr_code.eq.${code},id.eq.${code}`)
      .maybeSingle();
    if (!data) { setAlert({ kind: "unknown", msg: t("unknown_alert", lang) }); return; }
    if (data.blocked) { setAlert({ kind: "blocked", msg: t("blocked_alert", lang) }); setMatch(data); return; }
    const expected = new Date(data.expected_at).getTime();
    if (Date.now() - expected > 24 * 60 * 60 * 1000 || data.status === "cancelled") {
      setAlert({ kind: "expired", msg: t("expired_alert", lang) });
    }
    setMatch(data);
  }

  const sess = typeof window !== "undefined" ? sessionStorage.getItem("gate_session_id") ?? "" : "";
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "";

  async function doCheckIn() {
    try { await checkIn({ data: { visitorId: match.id, deviceInfo: device, sessionId: sess } });
      toast.success(t("checked_in", lang)); nav({ to: "/gate/approved" });
    } catch (e: any) { toast.error(e.message); }
  }
  async function doCheckOut() {
    try { await checkOut({ data: { visitorId: match.id, deviceInfo: device, sessionId: sess } });
      toast.success(t("checked_out", lang)); nav({ to: "/gate/approved" });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <QrScanner onResult={(txt) => resolve(txt)} />
      <div className="space-y-2">
        <Label>{t("manual_code", lang)}</Label>
        <div className="flex gap-2">
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="QR / ID" />
          <Button onClick={() => manual && resolve(manual.trim())}>OK</Button>
        </div>
      </div>
      {alert && <AlertBanner kind={alert.kind} message={alert.msg} />}
      {match && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="text-lg font-semibold">{match.visitor_name}</div>
            <div className="text-sm text-muted-foreground">
              {match.units?.unit_number ?? "—"} · {match.visitor_phone ?? "—"} · {match.car_plate ?? "—"}
            </div>
            <div className="flex gap-2 pt-2">
              <Button disabled={match.blocked} onClick={doCheckIn}>{t("check_in", lang)}</Button>
              <Button variant="outline" onClick={doCheckOut}>{t("check_out", lang)}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
