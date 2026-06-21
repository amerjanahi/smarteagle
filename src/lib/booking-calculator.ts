export type BookingPurpose = "personal" | "commercial" | "event" | "wedding";

export type ExtraService = { name: string; amount: number };

export const PURPOSE_MULTIPLIER: Record<BookingPurpose, number> = {
  personal: 1,
  commercial: 1.5,
  event: 1.75,
  wedding: 2,
};

export const PURPOSE_LABELS: Record<BookingPurpose, string> = {
  personal: "Personal use",
  commercial: "Commercial use",
  event: "Event",
  wedding: "Wedding",
};

export function calcBooking(args: {
  hourlyRate: number;
  hours: number;
  purpose: BookingPurpose;
  deposit: number;
  vatRate: number; // percent
  extras: ExtraService[];
}) {
  const hours = Math.max(0, args.hours);
  const multiplier = PURPOSE_MULTIPLIER[args.purpose];
  const base = +(args.hourlyRate * hours * multiplier).toFixed(3);
  const extras = +args.extras.reduce((s, e) => s + (Number(e.amount) || 0), 0).toFixed(3);
  const taxable = base + extras;
  const vatAmount = +((taxable * (args.vatRate || 0)) / 100).toFixed(3);
  const deposit = +(args.deposit || 0).toFixed(3);
  const total = +(taxable + vatAmount + deposit).toFixed(3);
  return { hours, base, extras, vatAmount, deposit, total, multiplier };
}

export function hoursBetween(startISO: string, endISO: string): number {
  if (!startISO || !endISO) return 0;
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return ms > 0 ? +(ms / 3600000).toFixed(2) : 0;
}
