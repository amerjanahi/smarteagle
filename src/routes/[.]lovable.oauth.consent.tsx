import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthClient = { name?: string; client_id?: string; redirect_uri?: string };
type AuthDetails = {
  client?: OAuthClient;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  scopes?: string[];
};

// The Supabase auth.oauth namespace is beta — declare a minimal local shape.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { mode: "signin", next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center px-6 bg-background">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-xl font-bold">Authorization error</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<null | "approve" | "deny">(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an app";
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(" ") : []);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) { setBusy(null); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(null); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-brand)] text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Hayy</span>
        </div>
        <h1 className="mt-6 font-display text-xl font-bold">
          Connect {clientName} to your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This lets {clientName} use Hayy tools as you. It doesn't bypass your account's permissions.
        </p>
        {scopes.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground list-disc pl-5">
            {scopes.map((s) => <li key={s}>{s}</li>)}
          </ul>
        )}
        {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" disabled={busy !== null} onClick={() => decide(true)}>
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
          </Button>
          <Button className="flex-1" variant="outline" disabled={busy !== null} onClick={() => decide(false)}>
            {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deny"}
          </Button>
        </div>
      </div>
    </div>
  );
}
