import { createFileRoute, Outlet, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/gate/BottomNav";
import { Button } from "@/components/ui/button";
import { LogOut, Languages, Phone } from "lucide-react";
import { getLang, setLang, t, type GateLang } from "@/lib/i18n/gate";

export const Route = createFileRoute("/_authenticated/gate")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: rs } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const roles = (rs ?? []).map((r: any) => r.role);
    if (!roles.includes("security") && !roles.includes("admin")) {
      throw redirect({ to: roles.length ? "/portal" : "/link-villa" });
    }
  },
  component: GateShell,
});

// Persistent session id for device/session tracking
if (typeof window !== "undefined" && !sessionStorage.getItem("gate_session_id")) {
  sessionStorage.setItem("gate_session_id", crypto.randomUUID());
}

function GateShell() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [lang, setL] = useState<GateLang>("en");
  useEffect(() => { setL(getLang()); }, []);

  function toggleLang() {
    const next: GateLang = lang === "en" ? "ar" : "en";
    setLang(next); setL(next);
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }
  useEffect(() => { document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; return () => { document.documentElement.dir = "ltr"; }; }, [lang]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/gate" className="font-display text-lg font-bold">{t("gate_portal", lang)}</Link>
          <div className="flex items-center gap-1">
            <Link to="/gate/emergency" className="mr-1 rounded-md p-2 text-muted-foreground hover:text-foreground" aria-label={t("emergency", lang)}>
              <Phone className="h-5 w-5" />
            </Link>
            <Button size="sm" variant="ghost" onClick={toggleLang} className="gap-1">
              <Languages className="h-4 w-4" /> {t("language", lang)}
            </Button>
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); nav({ to: "/auth" }); }} aria-label={t("sign_out", lang)}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
