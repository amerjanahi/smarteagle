import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { t, getLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate/emergency")({
  head: () => ({ meta: [{ title: "Emergency — Security Portal" }] }),
  component: EmergencyPage,
});

function EmergencyPage() {
  const lang = getLang();
  const { data = [] } = useQuery({
    queryKey: ["gate-emergency"],
    queryFn: async () => {
      const { data } = await supabase.from("emergency_contacts").select("*").order("priority", { ascending: true });
      return data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      {data.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
      {data.map((c: any) => (
        <Card key={c.id}>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.role_label ?? ""}</div>
              <div className="text-sm">{c.phone}</div>
            </div>
            <a href={`tel:${c.phone}`}>
              <Button size="sm"><Phone className="mr-1 h-4 w-4" /> {t("call", lang)}</Button>
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
