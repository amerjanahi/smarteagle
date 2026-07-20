export const MAX_STAY_HOURS = 8;
export const CRITICAL_STAY_HOURS = 24;

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const VISITOR_TYPES = [
  { value: "guest", label: "Guest" },
  { value: "food_delivery", label: "Food delivery" },
  { value: "courier", label: "Courier" },
  { value: "contractor", label: "Contractor" },
  { value: "taxi", label: "Taxi" },
  { value: "service", label: "Service provider" },
];

export function typeLabel(t?: string | null): string {
  return VISITOR_TYPES.find((x) => x.value === t)?.label ?? (t ?? "—");
}

export function deriveLiveStatus(v: {
  status: string;
  blocked?: boolean | null;
  checked_in_at?: string | null;
}): "Inside" | "Overdue" | "Denied" | "Exited" {
  if (v.blocked) return "Denied";
  if (v.status === "checked_out") return "Exited";
  if (v.status === "checked_in" && v.checked_in_at) {
    const hours = (Date.now() - new Date(v.checked_in_at).getTime()) / 3600000;
    return hours > MAX_STAY_HOURS ? "Overdue" : "Inside";
  }
  return "Inside";
}
