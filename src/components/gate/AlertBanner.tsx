import { AlertTriangle, X } from "lucide-react";

export function AlertBanner({ kind, message, onDismiss }: { kind: "blocked" | "expired" | "unknown"; message: string; onDismiss?: () => void }) {
  const color = kind === "blocked" ? "bg-destructive/15 border-destructive text-destructive"
              : kind === "expired" ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400"
              : "bg-muted border-border text-foreground";
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${color}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss"><X className="h-4 w-4" /></button>}
    </div>
  );
}
