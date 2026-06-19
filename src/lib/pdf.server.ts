import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type Template = {
  primary_color?: string;
  accent_color?: string;
  header_text?: string | null;
  footer_text?: string | null;
  logo_url?: string | null;
  layout?: "compact" | "standard" | "detailed";
  fields_json?: Record<string, boolean>;
};

function hex(h: string | undefined, fallback: [number, number, number]) {
  if (!h) return rgb(fallback[0], fallback[1], fallback[2]);
  const m = h.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function money(n: number | string | null | undefined, currency = "AED") {
  const v = Number(n ?? 0);
  return `${currency} ${v.toFixed(2)}`;
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

async function embedLogo(pdf: PDFDocument, url?: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("png")) return await pdf.embedPng(buf);
    if (ct.includes("jpeg") || ct.includes("jpg")) return await pdf.embedJpg(buf);
    return null;
  } catch {
    return null;
  }
}

export async function generatePdf(kind: "invoice" | "credit_note" | "receipt" | "statement", data: any, template: Template | null) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const primary = hex(template?.primary_color, [0.06, 0.09, 0.16]);
  const accent = hex(template?.accent_color, [0.23, 0.51, 0.96]);
  const muted = rgb(0.45, 0.45, 0.5);

  const logo = await embedLogo(pdf, template?.logo_url);

  // Header bar
  page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: primary });
  const title = kind === "invoice" ? "INVOICE"
    : kind === "receipt" ? "RECEIPT"
    : kind === "credit_note" ? "CREDIT NOTE"
    : "STATEMENT OF ACCOUNT";

  if (logo) {
    const dims = logo.scale(40 / logo.height);
    page.drawImage(logo, { x: 30, y: 800, width: dims.width, height: 40 });
  }
  page.drawText(title, { x: 420, y: 810, size: 18, font: bold, color: rgb(1, 1, 1) });

  if (template?.header_text) {
    page.drawText(template.header_text, { x: 30, y: 770, size: 9, font, color: muted });
  }

  let y = 740;

  // Meta block
  const drawKV = (label: string, value: string, x: number, yPos: number) => {
    page.drawText(label, { x, y: yPos, size: 8, font, color: muted });
    page.drawText(value, { x, y: yPos - 12, size: 10, font: bold, color: primary });
  };

  if (kind === "invoice") drawInvoice(page, font, bold, accent, primary, muted, data, y, money);
  else if (kind === "receipt") drawReceipt(page, font, bold, accent, primary, muted, data, y, money);
  else if (kind === "credit_note") drawCreditNote(page, font, bold, accent, primary, muted, data, y, money);
  else drawStatement(page, font, bold, accent, primary, muted, data, y, money);

  // Footer
  if (template?.footer_text) {
    page.drawLine({ start: { x: 30, y: 60 }, end: { x: 565, y: 60 }, color: muted, thickness: 0.5 });
    page.drawText(template.footer_text, { x: 30, y: 45, size: 8, font, color: muted });
  }

  return await pdf.save();
}

function drawInvoice(page: PDFPage, font: PDFFont, bold: PDFFont, accent: any, primary: any, muted: any, d: any, y: number, money: any) {
  const unit = d?.units;
  const resident = unit?.residents?.[0];
  const currency = d?.currency ?? "AED";

  page.drawText("Bill To", { x: 30, y, size: 8, font, color: muted });
  page.drawText(resident?.full_name ?? "Resident", { x: 30, y: y - 14, size: 11, font: bold, color: primary });
  page.drawText(`Unit ${unit?.unit_number ?? ""} ${unit?.building ?? ""}`.trim(), { x: 30, y: y - 28, size: 10, font, color: primary });
  if (resident?.email) page.drawText(resident.email, { x: 30, y: y - 42, size: 9, font, color: muted });

  page.drawText("Invoice #", { x: 380, y, size: 8, font, color: muted });
  page.drawText(d?.invoice_number ?? "—", { x: 380, y: y - 14, size: 11, font: bold, color: primary });
  page.drawText("Issued", { x: 380, y: y - 32, size: 8, font, color: muted });
  page.drawText(fmtDate(d?.created_at), { x: 380, y: y - 44, size: 10, font, color: primary });
  page.drawText("Due", { x: 480, y: y - 32, size: 8, font, color: muted });
  page.drawText(fmtDate(d?.due_date), { x: 480, y: y - 44, size: 10, font, color: primary });

  let tableY = y - 90;
  page.drawRectangle({ x: 30, y: tableY, width: 535, height: 22, color: accent });
  page.drawText("Description", { x: 38, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Qty", { x: 340, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Unit Price", { x: 390, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Tax %", { x: 460, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Total", { x: 520, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });

  tableY -= 18;
  const items = (d?.invoice_line_items ?? []).sort((a: any, b: any) => a.position - b.position);
  if (items.length === 0) {
    page.drawText(d?.description ?? "Service charge", { x: 38, y: tableY, size: 10, font, color: primary });
    page.drawText(money(d?.amount, currency), { x: 520, y: tableY, size: 10, font, color: primary });
    tableY -= 18;
  } else {
    for (const it of items) {
      page.drawText(String(it.description).slice(0, 50), { x: 38, y: tableY, size: 10, font, color: primary });
      page.drawText(String(it.quantity), { x: 340, y: tableY, size: 10, font, color: primary });
      page.drawText(money(it.unit_price, currency), { x: 390, y: tableY, size: 10, font, color: primary });
      page.drawText(`${it.tax_rate}%`, { x: 460, y: tableY, size: 10, font, color: primary });
      page.drawText(money(it.line_total, currency), { x: 520, y: tableY, size: 10, font, color: primary });
      tableY -= 16;
    }
  }

  tableY -= 16;
  page.drawLine({ start: { x: 350, y: tableY + 10 }, end: { x: 565, y: tableY + 10 }, color: muted, thickness: 0.5 });
  const totals = [
    ["Subtotal", money(d?.subtotal ?? d?.amount, currency)],
    ["Tax", money(d?.tax_amount ?? 0, currency)],
    ["Total", money(d?.amount, currency)],
    ["Paid", money(d?.amount_paid, currency)],
    ["Balance Due", money(Number(d?.amount) - Number(d?.amount_paid ?? 0), currency)],
  ];
  for (const [label, val] of totals) {
    page.drawText(label, { x: 380, y: tableY, size: 10, font, color: muted });
    page.drawText(val, { x: 500, y: tableY, size: 10, font: bold, color: primary });
    tableY -= 14;
  }
}

function drawReceipt(page: PDFPage, font: PDFFont, bold: PDFFont, accent: any, primary: any, muted: any, d: any, y: number, money: any) {
  const allocs = d?.payment_allocations ?? [];
  const first = allocs[0]?.invoices;
  const unit = first?.units;
  const resident = unit?.residents?.[0];
  page.drawText("Received From", { x: 30, y, size: 8, font, color: muted });
  page.drawText(resident?.full_name ?? "Resident", { x: 30, y: y - 14, size: 11, font: bold, color: primary });
  page.drawText(`Unit ${unit?.unit_number ?? ""} ${unit?.building ?? ""}`.trim(), { x: 30, y: y - 28, size: 10, font, color: primary });

  page.drawText("Receipt #", { x: 380, y, size: 8, font, color: muted });
  page.drawText(d?.receipt_number ?? "—", { x: 380, y: y - 14, size: 11, font: bold, color: primary });
  page.drawText("Date", { x: 380, y: y - 32, size: 8, font, color: muted });
  page.drawText(fmtDate(d?.paid_at), { x: 380, y: y - 44, size: 10, font, color: primary });

  let tableY = y - 100;
  page.drawRectangle({ x: 30, y: tableY, width: 535, height: 22, color: accent });
  page.drawText("Applied to Invoice", { x: 38, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Amount", { x: 480, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });

  tableY -= 18;
  for (const a of allocs) {
    page.drawText(a?.invoices?.invoice_number ?? a.invoice_id?.slice(0, 8) ?? "—", { x: 38, y: tableY, size: 10, font, color: primary });
    page.drawText(money(a.amount_applied), { x: 480, y: tableY, size: 10, font, color: primary });
    tableY -= 16;
  }

  tableY -= 10;
  page.drawText("Method", { x: 30, y: tableY, size: 9, font, color: muted });
  page.drawText(String(d?.payment_method ?? ""), { x: 30, y: tableY - 12, size: 10, font: bold, color: primary });
  page.drawText("Total Received", { x: 380, y: tableY, size: 9, font, color: muted });
  page.drawText(money(d?.amount), { x: 380, y: tableY - 12, size: 14, font: bold, color: primary });
  if (Number(d?.unallocated_amount ?? 0) > 0) {
    page.drawText(`Unallocated credit: ${money(d?.unallocated_amount)}`, { x: 30, y: tableY - 40, size: 9, font, color: muted });
  }
}

function drawCreditNote(page: PDFPage, font: PDFFont, bold: PDFFont, accent: any, primary: any, muted: any, d: any, y: number, money: any) {
  const unit = d?.units;
  const resident = unit?.residents?.[0];
  page.drawText("Issued To", { x: 30, y, size: 8, font, color: muted });
  page.drawText(resident?.full_name ?? "Resident", { x: 30, y: y - 14, size: 11, font: bold, color: primary });
  page.drawText(`Unit ${unit?.unit_number ?? ""} ${unit?.building ?? ""}`.trim(), { x: 30, y: y - 28, size: 10, font, color: primary });

  page.drawText("Credit Note #", { x: 380, y, size: 8, font, color: muted });
  page.drawText(d?.credit_note_number ?? "—", { x: 380, y: y - 14, size: 11, font: bold, color: primary });
  page.drawText("Issued", { x: 380, y: y - 32, size: 8, font, color: muted });
  page.drawText(fmtDate(d?.issued_at), { x: 380, y: y - 44, size: 10, font, color: primary });

  let tableY = y - 100;
  page.drawRectangle({ x: 30, y: tableY, width: 535, height: 22, color: accent });
  page.drawText("Reason / Items", { x: 38, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Amount", { x: 480, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  tableY -= 18;
  const items = d?.credit_note_line_items ?? [];
  if (items.length === 0) {
    page.drawText(String(d?.reason ?? "").slice(0, 60), { x: 38, y: tableY, size: 10, font, color: primary });
    page.drawText(money(d?.amount), { x: 480, y: tableY, size: 10, font, color: primary });
    tableY -= 16;
  } else {
    for (const it of items) {
      page.drawText(String(it.description).slice(0, 60), { x: 38, y: tableY, size: 10, font, color: primary });
      page.drawText(money(it.line_total), { x: 480, y: tableY, size: 10, font, color: primary });
      tableY -= 16;
    }
  }
  tableY -= 20;
  page.drawText("Total Credit", { x: 380, y: tableY, size: 9, font, color: muted });
  page.drawText(money(d?.amount), { x: 380, y: tableY - 12, size: 14, font: bold, color: primary });
  page.drawText("Remaining Balance", { x: 380, y: tableY - 36, size: 9, font, color: muted });
  page.drawText(money(d?.balance), { x: 380, y: tableY - 48, size: 12, font: bold, color: primary });
}

function drawStatement(page: PDFPage, font: PDFFont, bold: PDFFont, accent: any, primary: any, muted: any, d: any, y: number, money: any) {
  const unit = d?.unit;
  const resident = unit?.residents?.[0];
  page.drawText("Customer", { x: 30, y, size: 8, font, color: muted });
  page.drawText(resident?.full_name ?? "Resident", { x: 30, y: y - 14, size: 11, font: bold, color: primary });
  page.drawText(`Unit ${unit?.unit_number ?? ""} ${unit?.building ?? ""}`.trim(), { x: 30, y: y - 28, size: 10, font, color: primary });
  if (d.from || d.to) {
    page.drawText(`Period: ${d.from ?? "—"} to ${d.to ?? "—"}`, { x: 380, y, size: 9, font, color: muted });
  }

  let tableY = y - 90;
  page.drawRectangle({ x: 30, y: tableY, width: 535, height: 22, color: accent });
  page.drawText("Date", { x: 38, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Reference", { x: 120, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Description", { x: 240, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Debit", { x: 410, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Credit", { x: 460, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Balance", { x: 510, y: tableY + 7, size: 9, font: bold, color: rgb(1, 1, 1) });

  type Row = { date: string; ref: string; desc: string; debit: number; credit: number };
  const rows: Row[] = [];
  for (const inv of d.invoices ?? []) rows.push({ date: inv.created_at, ref: inv.invoice_number, desc: inv.description ?? "Invoice", debit: Number(inv.amount), credit: 0 });
  for (const p of d.payments ?? []) {
    const applied = (p.payment_allocations ?? []).reduce((s: number, a: any) => s + Number(a.amount_applied), 0);
    rows.push({ date: p.paid_at, ref: p.receipt_number, desc: `Payment (${p.payment_method})`, debit: 0, credit: applied });
  }
  for (const c of d.credits ?? []) rows.push({ date: c.issued_at, ref: c.credit_note_number, desc: `Credit: ${c.reason ?? ""}`, debit: 0, credit: Number(c.amount) });
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  tableY -= 18;
  let balance = 0;
  for (const r of rows.slice(0, 30)) {
    balance += r.debit - r.credit;
    page.drawText(fmtDate(r.date), { x: 38, y: tableY, size: 9, font, color: primary });
    page.drawText(String(r.ref ?? "").slice(0, 16), { x: 120, y: tableY, size: 9, font, color: primary });
    page.drawText(String(r.desc).slice(0, 28), { x: 240, y: tableY, size: 9, font, color: primary });
    page.drawText(r.debit ? r.debit.toFixed(2) : "", { x: 410, y: tableY, size: 9, font, color: primary });
    page.drawText(r.credit ? r.credit.toFixed(2) : "", { x: 460, y: tableY, size: 9, font, color: primary });
    page.drawText(balance.toFixed(2), { x: 510, y: tableY, size: 9, font: bold, color: primary });
    tableY -= 14;
  }
  tableY -= 12;
  page.drawText("Outstanding Balance", { x: 380, y: tableY, size: 9, font, color: muted });
  page.drawText(money(balance), { x: 380, y: tableY - 14, size: 14, font: bold, color: primary });
}

