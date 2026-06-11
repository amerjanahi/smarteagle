import { createFileRoute } from "@tanstack/react-router";
import { Wallet, Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Home — Hayy" }] }),
  component: PortalHome,
});

function PortalHome() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-muted-foreground">Hello,</p>
        <h1 className="font-display text-2xl font-bold">{user?.user_metadata.full_name ?? user?.email}</h1>
      </section>

      <section className="rounded-2xl bg-[var(--gradient-brand)] p-6 text-primary-foreground shadow-[var(--shadow-lifted)]">
        <div className="flex items-center gap-2 text-sm opacity-80">
          <Wallet className="h-4 w-4" /> Outstanding balance
        </div>
        <p className="mt-2 font-display text-4xl font-extrabold">BHD 0.000</p>
        <p className="mt-1 text-sm opacity-80">You're all caught up.</p>
      </section>

      <section className="grid gap-3">
        {[
          { icon: Sparkles, title: "Welcome to your portal", body: "Use the bottom tabs to view invoices, request maintenance, and register visitors." },
          { icon: Clock, title: "More features coming", body: "Invoice payment, maintenance photo uploads, and visitor QR codes are next." },
        ].map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/30 text-accent-foreground">
                <c.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.body}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
