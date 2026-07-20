import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertBanner } from "@/components/gate/AlertBanner";
import { ScanLine, UserPlus, Search, AlertTriangle } from "lucide-react";
import { t, getLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate/")({
  head: () => ({ meta: [{ title: "Security Portal — Hayy" }] }),
  component: GateHome,
});

function GateHome() {
  const lang = getLang();
  const [alerts, setAlerts] = useState<Array<{ kind: "blocked" | "expired" | "unknown"; msg: string; id: string }>>([]);

  const { data: today = [] } = useQuery({
    queryKey: ["gate-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const { data } = await supabase.from("visitors")
        .select("id, visitor_name, visitor_phone, status, expected_at, blocked, car_plate, unit_id, units(unit_number, building)")
        .gte("expected_at", start.toISOString()).lte("expected_at", end.toISOString())
        .order("expected_at", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  // Realtime: alert on any visitor row change with blocked=true
  useEffect(() => {
    const ch = supabase.channel("gate-visitors")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (!row) return;
        if (row.blocked) {
          setAlerts((a) => [...a, { kind: "blocked", msg: `${t("blocked_alert", lang)} — ${row.visitor_name}`, id: crypto.randomUUID() }]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lang]);

  return (
    <div className="space-y-4">
      {alerts.map((a) => (
        <AlertBanner key={a.id} kind={a.kind} message={a.msg} onDismiss={() => setAlerts((s) => s.filter((x) => x.id !== a.id))} />
      ))}

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t("quick_actions", lang)}</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { to: "/gate/scan", icon: ScanLine, label: t("scan_qr", lang) },
            { to: "/gate/checkin", icon: UserPlus, label: t("walk_in", lang) },
            { to: "/gate/search", icon: Search, label: t("search", lang) },
            { to: "/gate/incidents", icon: AlertTriangle, label: t("report_incident", lang) },
          ].map((a) => (
            <Link key={a.to} to={a.to} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 hover:bg-muted/40">
              <a.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t("today_expected", lang)} ({today.length})</h2>
        {today.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("no_visitors", lang)}
          </div>
        ) : (
          <div className="space-y-2">
            {today.map((v: any) => (
              <Card key={v.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <Link to="/gate/approved" className="flex-1">
                    <div className="text-sm font-medium">{v.visitor_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.units?.unit_number ?? "—"} · {new Date(v.expected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {v.car_plate && ` · ${v.car_plate}`}
                    </div>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    {v.blocked && <Badge variant="destructive">Blocked</Badge>}
                    <Badge variant={v.status === "checked_in" ? "default" : v.status === "checked_out" ? "secondary" : "outline"} className="text-[10px]">
                      {v.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
