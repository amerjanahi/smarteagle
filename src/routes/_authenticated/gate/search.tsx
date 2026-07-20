import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchGate, checkInVisitor, checkOutVisitor } from "@/lib/gate.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { t, getLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate/search")({
  head: () => ({ meta: [{ title: "Search — Security Portal" }] }),
  component: SearchPage,
});

function SearchPage() {
  const lang = getLang();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ visitors: any[]; units: any[] }>({ visitors: [], units: [] });
  const [busy, setBusy] = useState(false);
  const doSearch = useServerFn(searchGate);
  const inFn = useServerFn(checkInVisitor);
  const outFn = useServerFn(checkOutVisitor);
  const sess = typeof window !== "undefined" ? sessionStorage.getItem("gate_session_id") ?? "" : "";
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "";

  async function run() {
    setBusy(true);
    try { setRes(await doSearch({ data: { q } }) as any); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_placeholder", lang)} />
        <Button type="submit" disabled={busy}>{t("search", lang)}</Button>
      </form>
      {res.visitors.length === 0 && res.units.length === 0 && q && !busy && (
        <p className="text-sm text-muted-foreground">{t("no_results", lang)}</p>
      )}
      {res.visitors.map((v: any) => (
        <Card key={v.id}>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{v.visitor_name}</div>
                <div className="text-xs text-muted-foreground">
                  {v.units?.unit_number ?? "—"} · {v.visitor_phone ?? "—"} · {v.car_plate ?? "—"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {v.blocked && <Badge variant="destructive">Blocked</Badge>}
                <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={v.blocked} onClick={async () => {
                try { await inFn({ data: { visitorId: v.id, deviceInfo: device, sessionId: sess } }); toast.success(t("checked_in", lang)); run(); }
                catch (e: any) { toast.error(e.message); }
              }}>{t("check_in", lang)}</Button>
              <Button size="sm" variant="outline" onClick={async () => {
                try { await outFn({ data: { visitorId: v.id, deviceInfo: device, sessionId: sess } }); toast.success(t("checked_out", lang)); run(); }
                catch (e: any) { toast.error(e.message); }
              }}>{t("check_out", lang)}</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {res.units.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">{t("unit", lang)}</h3>
          <div className="grid grid-cols-2 gap-2">
            {res.units.map((u: any) => (
              <div key={u.id} className="rounded-md border border-border bg-card p-2 text-sm">
                {u.unit_number} {u.building && <span className="text-muted-foreground"> · {u.building}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
