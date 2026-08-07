import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sanitizeHtml } from "@/lib/sanitize-html";

export const Route = createFileRoute("/_authenticated/portal/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Hayy" }] }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);
  const { data } = useQuery({
    queryKey: ["notices", "portal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notices").select("id, subject, body, image_url, published_at").eq("status", "published").order("published_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function openNotice(notice: any) {
    setSelectedAnnouncement(notice);
    // The database accepts one receipt per recipient and verifies their audience.
    const { error } = await supabase.rpc("record_notice_view" as any, { p_notice_id: notice.id } as any);
    if (error) console.warn("Could not record notice view", error.message);
  }

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
              onClick={() => void openNotice(a)}
              className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-[var(--shadow-soft)] transition hover:bg-accent/20"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.subject}</p>
                  <p className="text-xs text-muted-foreground">{a.published_at ? new Date(a.published_at).toLocaleDateString() : "Draft"}</p>
                  {a.body && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.body.replace(/<[^>]+>/g, " ")}</p>}
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
            <DialogTitle>{selectedAnnouncement?.subject}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {selectedAnnouncement?.published_at ? new Date(selectedAnnouncement.published_at).toLocaleDateString() : "Draft"}
            </p>
          </DialogHeader>
          {selectedAnnouncement?.image_url && <img src={selectedAnnouncement.image_url} alt="" className="w-full rounded-lg" />}
          <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedAnnouncement?.body ?? "") }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
