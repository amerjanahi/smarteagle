import type { TplType } from "./types";

export const MERGE_FIELDS: Record<TplType, { key: string; label: string; sample: string }[]> = {
  invoice: [
    { key: "doc.number", label: "Invoice #", sample: "INV-2026-00001" },
    { key: "doc.date", label: "Issue Date", sample: "2026-01-20" },
    { key: "doc.due_date", label: "Due Date", sample: "2026-02-20" },
    { key: "doc.currency", label: "Currency", sample: "AED" },
    { key: "resident.full_name", label: "Customer Name", sample: "John Doe" },
    { key: "resident.email", label: "Customer Email", sample: "john@example.com" },
    { key: "unit.unit_number", label: "Unit #", sample: "101" },
    { key: "unit.building", label: "Building", sample: "Block A" },
    { key: "totals.subtotal", label: "Subtotal", sample: "1,000.00" },
    { key: "totals.tax", label: "Tax", sample: "50.00" },
    { key: "totals.total", label: "Total", sample: "1,050.00" },
    { key: "totals.paid", label: "Paid", sample: "0.00" },
    { key: "totals.balance", label: "Balance Due", sample: "1,050.00" },
    { key: "company.name", label: "Company Name", sample: "Hayy Communities" },
    { key: "company.address", label: "Company Address", sample: "PO Box 123" },
  ],
  receipt: [
    { key: "doc.number", label: "Receipt #", sample: "RCP-2026-00001" },
    { key: "doc.date", label: "Payment Date", sample: "2026-01-20" },
    { key: "doc.method", label: "Method", sample: "Bank Transfer" },
    { key: "resident.full_name", label: "Received From", sample: "John Doe" },
    { key: "unit.unit_number", label: "Unit #", sample: "101" },
    { key: "totals.total", label: "Amount", sample: "1,050.00" },
    { key: "company.name", label: "Company Name", sample: "Hayy Communities" },
  ],
  credit_note: [
    { key: "doc.number", label: "Credit Note #", sample: "CN-2026-00001" },
    { key: "doc.date", label: "Issue Date", sample: "2026-01-20" },
    { key: "resident.full_name", label: "Customer", sample: "John Doe" },
    { key: "unit.unit_number", label: "Unit #", sample: "101" },
    { key: "totals.total", label: "Credit Total", sample: "500.00" },
    { key: "totals.balance", label: "Remaining", sample: "500.00" },
  ],
  statement: [
    { key: "resident.full_name", label: "Customer", sample: "John Doe" },
    { key: "unit.unit_number", label: "Unit #", sample: "101" },
    { key: "period.from", label: "From", sample: "2026-01-01" },
    { key: "period.to", label: "To", sample: "2026-01-31" },
    { key: "totals.balance", label: "Outstanding", sample: "1,050.00" },
  ],
  work_order: [
    { key: "doc.number", label: "Work Order #", sample: "WO-2026-00001" },
    { key: "doc.date", label: "Date", sample: "2026-01-20" },
    { key: "resident.full_name", label: "Requestor", sample: "John Doe" },
    { key: "unit.unit_number", label: "Unit #", sample: "101" },
    { key: "wo.description", label: "Work Description", sample: "Fix AC unit" },
    { key: "wo.assignee", label: "Assigned To", sample: "Maintenance Team" },
  ],
  purchase_order: [
    { key: "doc.number", label: "PO #", sample: "PO-2026-00001" },
    { key: "doc.date", label: "Date", sample: "2026-01-20" },
    { key: "vendor.name", label: "Vendor", sample: "ACME Supplies" },
    { key: "totals.subtotal", label: "Subtotal", sample: "5,000.00" },
    { key: "totals.tax", label: "Tax", sample: "250.00" },
    { key: "totals.total", label: "Total", sample: "5,250.00" },
  ],
};

export function resolveMergeTokens(text: string, type: TplType, data?: Record<string, string>): string {
  const map: Record<string, string> = { ...data };
  if (!data) {
    for (const f of MERGE_FIELDS[type]) map[f.key] = f.sample;
  }
  return String(text ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
}
