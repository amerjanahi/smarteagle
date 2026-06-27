import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Hayy" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Supabase puts the recovery token in the URL hash and the SDK exchanges it
  // for a session on load. Wait until the session is present before allowing
  // the user to set a new password.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && s) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) { toast.error("Open this page from the reset link in your email."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You can sign in now.");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-brand)] text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Hayy</span>
        </div>
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "Enter your new password below."
            : "Waiting for the reset link… open this page directly from the email we sent you."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="np">New password</Label>
            <Input id="np" type="password" minLength={6} required autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
