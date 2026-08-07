import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PreviewLine = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
};

type Props = {
  form: {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    description: string;
    due_date: string;
    period_start: string;
    period_end: string;
    payment_terms: string;
    notes: string;
    discount_type: "amount" | "percentage";
    discount_value: string;
  };
  unitLabel?: string;
  lines: PreviewLine[];
  attachments: { name: string; url: string }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  money: (value: number) => string;
};

function useCompanyProfile() {
  const { data } = useQuery({
    queryKey: ["company-profile-preview"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: settings } = await (supabase
        .from("company_settings" as any)
        .select("company_name, logo_url")
        .maybeSingle() as any);
      return {
        name: (settings?.company_name as string | undefined) ?? "Your company",
        logoUrl: (settings?.logo_url as string | undefined) ?? null,
      };
    },
  });
  return data ?? { name: "Your company", logoUrl: null };
}

function Placeholder({ children }: { children: string }) {
  return <span className="italic text-muted-foreground/70">{children}</span>;
}

function formatDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function InvoicePreview({
  form, unitLabel, lines, attachments, subtotal, tax, discount, total, money,
}: Props) {
  const company = useCompanyProfile();
  const due = formatDate(form.due_date);
  const periodFrom = formatDate(form.period_start);
  const periodTo = formatDate(form.period_end);

  return (
    <div className="mx-auto min-h-[1123px] w-full max-w-[794px] overflow-hidden rounded-none border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-slate-950 bg-slate-950 p-8 text-white">
        <div className="flex min-w-0 items-center gap-3">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={`${company.name} logo`} className="h-10 w-10 shrink-0 rounded-md object-contain" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{company.name}</p>
            <p className="text-xs text-white/70">Tax invoice</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-bold tracking-tight">INVOICE</p>
          <p className="text-xs text-white/70">No. assigned on save</p>
        </div>
      </div>

      <div className="space-y-7 p-8 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Billed to</p>
            <p className="mt-1 truncate font-medium">
              {form.customer_name || <Placeholder>Customer name</Placeholder>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {form.customer_email || <Placeholder>email@example.com</Placeholder>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {form.customer_phone || <Placeholder>Phone number</Placeholder>}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {unitLabel || <Placeholder>Unit not selected</Placeholder>}
            </p>
          </div>
          <div className="space-y-1 sm:text-right">
            <p className="text-xs text-muted-foreground">
              Due date: <span className="font-medium text-foreground">{due ?? "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Terms: <span className="font-medium text-foreground">{form.payment_terms || "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Service period:{" "}
              <span className="font-medium text-foreground">
                {periodFrom || periodTo ? `${periodFrom ?? "—"} → ${periodTo ?? "—"}` : "—"}
              </span>
            </p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Subject</p>
          <p className="mt-1">{form.description || <Placeholder>Invoice description</Placeholder>}</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Description</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="px-2 py-2 text-right font-medium">Rate</th>
                <th className="px-2 py-2 text-right font-medium">VAT</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const net = Number(line.quantity || 0) * Number(line.unit_price || 0);
                const lineTotal = net + (net * Number(line.tax_rate || 0)) / 100;
                return (
                  <tr key={index} className="border-t border-border">
                    <td className="max-w-[180px] truncate px-2 py-2">
                      {line.description || <Placeholder>Line description</Placeholder>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{line.quantity || 0}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(Number(line.unit_price || 0))}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{Number(line.tax_rate || 0)}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="ml-auto grid max-w-[260px] grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-right tabular-nums">{money(subtotal)}</span>
          <span className="text-muted-foreground">VAT</span>
          <span className="text-right tabular-nums">{money(tax)}</span>
          <span className="text-muted-foreground">
            Discount{form.discount_type === "percentage" && form.discount_value ? ` (${form.discount_value}%)` : ""}
          </span>
          <span className="text-right tabular-nums">− {money(discount)}</span>
          <span className="border-t border-border pt-1 font-semibold">Total due</span>
          <span className="border-t border-border pt-1 text-right font-semibold tabular-nums">{money(total)}</span>
        </div>

        {form.notes ? (
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
            <p className="font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap">{form.notes}</p>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">Attachments</p>
            <ul className="mt-1 list-inside list-disc">
              {attachments.map((attachment, index) => (
                <li key={index} className="truncate">{attachment.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
