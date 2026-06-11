import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Building2, ShieldCheck, Smartphone, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hayy — Community Management Platform" },
      { name: "description", content: "Run a community building with less friction. Residents pay invoices, request maintenance, and register visitors from one place." },
      { property: "og:title", content: "Hayy — Community Management Platform" },
      { property: "og:description", content: "Run a community building with less friction. Residents pay invoices, request maintenance, and register visitors from one place." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, role, loading } = useAuth();

  if (!loading && session) {
    return <Navigate to={role === "admin" ? "/admin" : "/portal"} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-brand)] text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">Hayy</span>
        </div>
        <Button asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12 md:pt-20">
        <section className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              For residents and building managers
            </span>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
              Run your community without the paperwork.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              One portal for invoices, payments, maintenance requests, and visitor access — designed for residents on mobile and managers on the desktop.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth" search={{ mode: "signup" }}>Create an account</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lifted)]">
            <div className="space-y-4">
              {[
                { icon: Smartphone, title: "Mobile resident portal", body: "Pay invoices, request maintenance, register visitors — all from your phone." },
                { icon: Wrench, title: "Admin desktop tools", body: "Units, residents, invoices, payments, reports — managed from one sidebar." },
                { icon: ShieldCheck, title: "Built-in security", body: "Row-level access means residents only see their own unit's data." },
              ].map((f) => (
                <div key={f.title} className="flex gap-3 rounded-xl bg-surface p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <p className="text-sm text-muted-foreground">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
