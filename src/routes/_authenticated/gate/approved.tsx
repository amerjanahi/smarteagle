import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { checkInVisitor, checkOutVisitor } from "@/lib/gate.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { t, getLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate/approved")({
  head: () => ({ meta: [{ title: "Approved — Security Portal" }] }),
  component: ApprovedPage,
});

function ApprovedPage() {
  const lang = getLang();
  const qc = useQueryClient();
  const inFn = useServerFn(checkInVisitor);
  const outFn = useServerFn(checkOutVisitor);

  const { data = [] } = useQuery({
    queryKey: ["gate-approved"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("visitors")
        .select("id, visitor_name, visitor_phone, car_plate, status, blocked, expected_at, checked_in_at, checked_out_at, units(unit_number, building)")
        .gte("expected_at", start.toISOString())
        .order("expected_at", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const sess = typeof window !== "undefined" ? sessionStorage.getItem("gate_session_id") ?? "" : "";
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "";

  async function act(id: string, kind: "in" | "out") {
    try {
      if (kind === "in") await inFn({ data: { visitorId: id, deviceInfo: device, sessionId: sess } });
      else await outFn({ data: { visitorId: id, deviceInfo: device, sessionId: sess } });
      toast.success(kind === "in" ? t("checked_in", lang) : t("checked_out", lang));
      qc.invalidateQueries({ queryKey: ["gate-approved"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-2">
      {data.length === 0 && <p className="text-sm text-muted-foreground">{t("no_visitors", lang)}</p>}
      {data.map((v: any) => (
        <Card key={v.id}>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{v.visitor_name}</div>
                <div className="text-xs text-muted-foreground">
                  {v.units?.unit_number ?? "—"} · {new Date(v.expected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {v.car_plate && ` · ${v.car_plate}`}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {v.blocked && <Badge variant="destructive">Blocked</Badge>}
                <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={v.blocked || v.status === "checked_in"} onClick={() => act(v.id, "in")}>
                {t("check_in", lang)}
              </Button>
              <Button size="sm" variant="outline" disabled={v.status !== "checked_in"} onClick={() => act(v.id, "out")}>
                {t("check_out", lang)}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
