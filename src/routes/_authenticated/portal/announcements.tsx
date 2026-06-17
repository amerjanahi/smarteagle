import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Hayy" }] }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("published_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Announcements</h1>
      </header>
      {(data?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 h-6 w-6" />No announcements
        </div>
      )}
      <ul className="space-y-2">
        {data?.map((a) => (
          <li key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <p className="font-medium">{a.title}</p>
            <p className="text-xs text-muted-foreground">{a.published_at ? new Date(a.published_at).toLocaleDateString() : "Draft"}</p>
            {a.body && <p className="mt-2 text-sm">{a.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
