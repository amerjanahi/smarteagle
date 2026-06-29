import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Verifying… — Hayy" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Verifying your link…");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errDesc = url.searchParams.get("error_description") || url.hash.match(/error_description=([^&]+)/)?.[1];

        if (errDesc) {
          toast.error(decodeURIComponent(errDesc.replace(/\+/g, " ")));
          navigate({ to: "/auth" });
          return;
        }

        // PKCE flow (?code=...)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }
        // Implicit flow puts tokens in #access_token=...; the SDK picks them up automatically.

        // Wait briefly for session
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) break;
          await new Promise((r) => setTimeout(r, 150));
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setMsg("Link expired or already used. Please sign in.");
          setTimeout(() => navigate({ to: "/auth" }), 1500);
          return;
        }

        // Decide destination by role
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", session.user.id);
        const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
        if (isAdmin) { navigate({ to: "/admin" }); return; }
        const { data: links } = await supabase
          .from("user_villas").select("id").eq("user_id", session.user.id).eq("status", "active").limit(1);
        navigate({ to: (links && links.length > 0) ? "/portal" : "/link-villa" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not verify link");
        navigate({ to: "/auth" });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{msg}</p>
      </div>
    </div>
  );
}
