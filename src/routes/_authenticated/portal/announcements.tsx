import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/portal/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Hayy" }] }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);
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
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setSelectedAnnouncement(a)}
              className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-[var(--shadow-soft)] transition hover:bg-accent/20"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.published_at ? new Date(a.published_at).toLocaleDateString() : "Draft"}</p>
                  {a.body && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>}
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAnnouncement?.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {selectedAnnouncement?.published_at ? new Date(selectedAnnouncement.published_at).toLocaleDateString() : "Draft"}
            </p>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedAnnouncement?.body}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
