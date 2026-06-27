import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wallet,
  FileText,
  Wrench,
  CalendarCheck,
  UserPlus,
  Phone,
  Calculator,
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Sparkles,
  LifeBuoy,
  Receipt,
  CreditCard,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Home — Hayy" }] }),
  component: PortalHome,
});

function PortalHome() {
  const { user } = useAuth();
  const fullName =
    ((user?.user_metadata as { full_name?: string } | undefined)?.full_name?.trim()) ||
    user?.email?.split("@")[0] ||
    "Resident";

  const quickActions = [
    { to: "/portal/invoices", label: "Pay Invoice", icon: CreditCard, tone: "from-primary/15 to-primary/5 text-primary" },
    { to: "/portal/maintenance", label: "Request Repair", icon: Wrench, tone: "from-accent/25 to-accent/5 text-accent-foreground" },
    { to: "/portal/amenities", label: "Book Amenity", icon: CalendarCheck, tone: "from-primary/15 to-primary/5 text-primary" },
    { to: "/portal/visitors", label: "Register Visitor", icon: UserPlus, tone: "from-accent/25 to-accent/5 text-accent-foreground" },
    { to: "/portal/calculator", label: "Fees Calculator", icon: Calculator, tone: "from-accent/25 to-accent/5 text-accent-foreground" },
    { to: "/portal/more", label: "Contact Management", icon: Phone, tone: "from-primary/15 to-primary/5 text-primary" },
  ] as const;

  const summary = [
    { label: "Invoices", value: "0", hint: "unpaid", icon: Receipt },
    { label: "Payments", value: "0", hint: "pending", icon: CreditCard },
    { label: "Requests", value: "0", hint: "open", icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <section className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Hello, <span className="text-primary">{fullName}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Welcome back to your community portal</p>
      </section>

      {/* Latest announcement hero (clickable) */}
      <Link
        to="/portal/announcements"
        className="relative block overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-lifted)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lifted)]"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-accent/30 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary-foreground/90">
              <Megaphone className="h-4 w-4" />
              Latest Announcement
            </div>
            <Badge className="border-0 bg-white/20 text-primary-foreground hover:bg-white/25">
              New
            </Badge>
          </div>

          <p className="mt-4 font-display text-2xl font-bold leading-snug tracking-tight text-primary-foreground drop-shadow-sm">
            Pool maintenance this Friday
          </p>
          <p className="mt-2 text-sm font-medium text-primary-foreground/95">
            Scheduled 8am–12pm. Tap to view all notices.
          </p>

          <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground">
            View all announcements <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </Link>

      {/* Outstanding balance — compact */}
      <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Outstanding balance
            </p>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Up to date
            </Badge>
          </div>
          <p className="mt-0.5 font-display text-xl font-bold tabular-nums">BHD 0.000</p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
          <Link to="/portal/invoices">
            <FileText className="mr-1.5 h-4 w-4" /> Invoices
          </Link>
        </Button>
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lifted)]"
            >
              <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${a.tone}`}>
                <a.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{a.label}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                Open <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Mini summary */}
      <section className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
        {summary.map((s) => (
          <div key={s.label} className="flex flex-col items-center px-2 py-2 text-center">
            <s.icon className="h-4 w-4 text-primary" />
            <p className="mt-1 font-display text-xl font-bold leading-none">{s.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">{s.label}</span> · {s.hint}
            </p>
          </div>
        ))}
      </section>

      {/* Info cards */}
      <section className="space-y-3">
        <InfoCard
          icon={Megaphone}
          title="Latest Announcement"
          body="Pool maintenance scheduled this Friday 8am–12pm. Thank you for your patience."
          cta={{ label: "See all", to: "/portal/announcements" }}
          accent="primary"
        />
        <InfoCard
          icon={Sparkles}
          title="Upcoming Features"
          body="One-tap invoice payment, visitor QR codes, and amenity calendar are coming soon."
          accent="accent"
        />
        <InfoCard
          icon={LifeBuoy}
          title="Need Help?"
          body="Reach community management 24/7 for any portal or property questions."
          cta={{ label: "Contact", to: "/portal/more" }}
          accent="primary"
        />
      </section>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
  cta,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta?: { label: string; to: string };
  accent: "primary" | "accent";
}) {
  const ring =
    accent === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-accent/30 text-accent-foreground";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ring}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-foreground">{title}</p>
          {cta ? (
            <Link to={cta.to} className="shrink-0 text-xs font-medium text-primary hover:underline">
              {cta.label}
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
