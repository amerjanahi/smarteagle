import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ScanLine, UserPlus, Search, AlertTriangle } from "lucide-react";
import { t, getLang } from "@/lib/i18n/gate";

const items = [
  { to: "/gate", label: "home" as const, icon: Home },
  { to: "/gate/scan", label: "scan" as const, icon: ScanLine },
  { to: "/gate/checkin", label: "checkin" as const, icon: UserPlus },
  { to: "/gate/search", label: "search" as const, icon: Search },
  { to: "/gate/incidents", label: "incidents" as const, icon: AlertTriangle },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const lang = getLang();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/gate" && path.startsWith(it.to));
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link to={it.to} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
                <span>{t(it.label, lang)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
