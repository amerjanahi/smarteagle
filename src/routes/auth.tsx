import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Building2, Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { bootstrapAdminIfEmpty } from "@/lib/admin.functions";
import { biometric } from "@/lib/biometric";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

type SignInMethod = "password" | "email-otp" | "phone-otp";

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Hayy" },
      { name: "description", content: "Sign in to your community portal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { session, role, loading: authLoading, refreshRole } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => { biometric.isAvailable().then(setBioAvailable); }, []);

  // Redirect if already signed in (effect, not during render — avoids hydration mismatch)
  useEffect(() => {
    if (!authLoading && session && role) {
      navigate({ to: role === "admin" ? "/admin" : "/portal" });
    }
  }, [authLoading, session, role, navigate]);

  async function checkApprovalAndRoute() {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) return;
    const { data: profile } = await supabase
      .from("profiles").select("approval_status").eq("id", s.user.id).maybeSingle();
    if (profile?.approval_status === "rejected") {
      await supabase.auth.signOut();
      toast.error("Your account has been rejected. Contact the building administrator.");
      return;
    }
    try {
      const res = await bootstrapAdminIfEmpty();
      if (res.promoted) toast.success("You're the first user — promoted to admin.");
    } catch { /* ignore */ }
    await refreshRole();
    // Residents go to villa-linking; the link-villa page sends them onward
    // once they have an approved villa. Admins go straight to /admin.
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", s.user.id);
    const isAdmin = (roleRow ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      const { data: links } = await supabase
        .from("user_villas").select("id").eq("user_id", s.user.id).eq("status", "active").limit(1);
      navigate({ to: (links && links.length > 0) ? "/portal" : "/link-villa" });
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: fullName, phone },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        // Save phone on profile (trigger created the row)
        if (signUpData.user) {
          await supabase.from("profiles").update({ phone, full_name: fullName }).eq("id", signUpData.user.id);
        }
        toast.success("Account created. Please verify your email, then link your villa.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Offer to remember credentials for biometric unlock on this device.
        if (await biometric.isAvailable()) {
          try { await biometric.save({ username: email, password }); } catch { /* ignore */ }
        }
      }
      await checkApprovalAndRoute();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp(channel: "email" | "phone") {
    setBusy(true);
    try {
      if (channel === "email") {
        const { error } = await supabase.auth.signInWithOtp({
          email, options: { shouldCreateUser: false },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) throw error;
      }
      setOtpSent(true);
      toast.success("Code sent. Check your messages.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally { setBusy(false); }
  }

  async function verifyOtp(channel: "email" | "phone") {
    setBusy(true);
    try {
      const { error } = channel === "email"
        ? await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" })
        : await supabase.auth.verifyOtp({ phone, token: otpCode, type: "sms" });
      if (error) throw error;
      await checkApprovalAndRoute();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally { setBusy(false); }
  }

  async function handleForgot() {
    if (!email) { toast.error("Enter your email first."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent. Check your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link");
    } finally { setBusy(false); }
  }

  async function handleBiometric() {
    setBusy(true);
    try {
      const creds = await biometric.unlock();
      if (!creds) { toast.error("Biometric not available or cancelled."); return; }
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.username, password: creds.password,
      });
      if (error) throw error;
      await checkApprovalAndRoute();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Biometric sign-in failed");
    } finally { setBusy(false); }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        await checkApprovalAndRoute();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h1 className="font-display text-xl font-bold">Awaiting admin approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account has been created. A building administrator needs to approve your access before you can sign in.
            You'll be notified once approved.
          </p>
          <Button className="mt-6 w-full" variant="outline" onClick={async () => { await supabase.auth.signOut(); setPending(false); }}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <Link to="/" className="flex items-center gap-2 self-start">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-brand)] text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Hayy</span>
        </Link>


        <div className="mt-12 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-2xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "The first account becomes the building admin."
              : "Sign in to access your community portal."}
          </p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleEmail} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleEmail} className="space-y-3">
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required autoComplete="name" autoCapitalize="words" spellCheck value={fullName} onChange={(e) => setFullName(e.target.value)} />

                </div>
                <div>
                  <Label htmlFor="phone-up">Phone number</Label>
                  <Input id="phone-up" type="tel" autoComplete="tel" required placeholder="+973 …"
                    value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password-up">Password</Label>
                  <Input id="password-up" type="password" autoComplete="new-password" required minLength={6}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </Button>

          <p className="mt-6 text-xs text-muted-foreground">
            Demo tip: the first account to sign up automatically becomes the admin. After that, new signups join as residents and you can link them to a unit from the admin Residents page.
          </p>
        </div>
      </div>
    </div>
  );
}
