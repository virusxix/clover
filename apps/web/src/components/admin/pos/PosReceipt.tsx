"use client";

/**
 * THE CLOVER store receipt — matches the botanical invoice layout.
 * On-screen: cream + sage. Print/PNG: bold black for XP-80C thermal.
 * Logo mark is unchanged (logo-clover.svg paths).
 */

import { formatMMK } from "@/lib/currency";
import { PAYMENT_LABELS } from "@/lib/payments";

export type ReceiptItem = {
  productName: string;
  productCode?: string | null;
  colorName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ReceiptData = {
  saleId: string;
  soldAt: string;
  total: number;
  notes?: string;
  paymentMethod?: string;
  items: ReceiptItem[];
  /** Optional walk-in customer fields (blank on receipt if omitted). */
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
};

/** Roll width options (mm). XP-80C = 80mm. */
export type PaperWidthMm = 58 | 80 | 56 | 77 | 107 | 210;

export const PAPER_OPTIONS: { mm: PaperWidthMm; label: string }[] = [
  { mm: 80, label: "80mm (XP-80C)" },
  { mm: 58, label: "58mm" },
  { mm: 56, label: "56mm (2\")" },
  { mm: 77, label: "77mm (3\")" },
  { mm: 107, label: "107mm (4\")" },
  { mm: 210, label: "210mm (A4)" },
];

/** Printable area inside the roll (thermal heads don't print to the edge). */
function printableWidthMm(paperMm: PaperWidthMm): number {
  if (paperMm >= 210) return 190;
  if (paperMm >= 107) return 100;
  if (paperMm >= 80) return 72; // XP-80C: 80mm roll → ~72mm print
  if (paperMm >= 77) return 68;
  return 48; // 56 / 58mm
}

const PAY_LABELS = PAYMENT_LABELS;

const PAPER_STORAGE_KEY = "clover-pos-paper-mm";

const STORE_PHONES = ["09791946536", "09666888627"];
const STORE_ADDRESS = "69*33 Corner Chan Aye Thar Zan";
const STORE_MESSENGER = "The Clover";

/** Invoice-style number from sale UUID (e.g. 00282). */
function invoiceNo(saleId: string): string {
  const hex = saleId.replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16) % 100000;
  return String(Number.isFinite(n) ? n : 0).padStart(5, "0");
}

function noteClean(notes?: string) {
  return (notes || "").replace(/\s*·\s*pay:[a-z_]+/i, "").trim();
}

/** Official clover mark — same paths as /assets/logo-clover.svg (do not alter). */
function CloverMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M24 8 C30 8 34 12 34 18 C34 24 30 28 24 28 C18 28 14 24 14 18 C14 12 18 8 24 8 Z
           M24 20 C30 20 34 24 34 30 C34 36 30 40 24 40 C18 40 14 36 14 30 C14 24 18 20 24 20 Z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M40 24 C40 30 36 34 30 34 C24 34 20 30 20 24 C20 18 24 14 30 14 C36 14 40 18 40 24 Z
           M28 24 C28 30 24 34 18 34 C12 34 8 30 8 24 C8 18 12 14 18 14 C24 14 28 18 28 24 Z"
      />
    </svg>
  );
}

function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" className={className} aria-hidden>
      <path
        d="M6.5 3.5h3l1.2 4.2-2 1.2a12 12 0 0 0 5.4 5.4l1.2-2 4.2 1.2v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 5 5.1 1.5 1.5 0 0 1 6.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" className={className} aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" className={className} aria-hidden>
      <path
        d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6A3.5 3.5 0 0 1 15.5 16H11l-4 3.5V16H8.5A3.5 3.5 0 0 1 5 12.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function loadPaperWidth(): PaperWidthMm {
  if (typeof window === "undefined") return 80;
  const n = Number(localStorage.getItem(PAPER_STORAGE_KEY));
  if (n === 80 || n === 58 || n === 56 || n === 77 || n === 107 || n === 210) return n;
  return 80;
}

export function savePaperWidth(mm: PaperWidthMm) {
  localStorage.setItem(PAPER_STORAGE_KEY, String(mm));
}

type Props = {
  receipt: ReceiptData;
  className?: string;
};

/** On-screen preview — botanical invoice layout (cream + sage). */
export function PosReceipt({ receipt, className = "" }: Props) {
  const inv = invoiceNo(receipt.saleId);
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const name = receipt.customerName?.trim() || "";
  const phone = receipt.customerPhone?.trim() || "";
  const address = receipt.customerAddress?.trim() || "";
  const note = noteClean(receipt.notes);

  return (
    <div
      className={`pos-receipt relative overflow-hidden rounded-sm border border-[#d9d2c4] bg-[#f3eee4] text-[#1a1a1a] shadow-[0_1px_0_rgba(0,0,0,0.04)] ${className}`}
      data-receipt
    >
      {/* Soft sage botanical washes (screen only) */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, rgba(140,168,130,0.55), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full opacity-45"
        style={{
          background:
            "radial-gradient(circle at 60% 50%, rgba(140,168,130,0.5), transparent 72%)",
        }}
      />

      <div className="pos-receipt__inner relative px-4 py-5 sm:px-5">
        {/* Header: logo | brand | phones */}
        <header className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
          <div className="text-[#1a1a1a] pt-0.5">
            <CloverMark size={42} />
          </div>
          <div className="text-center min-w-0 pt-1">
            <p className="font-serif text-[17px] font-bold tracking-[0.08em] uppercase leading-none">
              THE CLOVER
            </p>
            <p className="mt-1 font-serif text-[12px] italic tracking-wide text-[#333]">
              Sportswear
            </p>
          </div>
          <div className="text-right text-[10px] font-bold leading-snug pt-1">
            <div className="inline-flex items-start gap-1.5">
              <PhoneIcon className="mt-0.5 shrink-0 text-[#1a1a1a]" />
              <div>
                {STORE_PHONES.map((p) => (
                  <p key={p} className="tabular-nums tracking-wide">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Invoice meta */}
        <div className="mt-5 grid grid-cols-[1fr_1.35fr] gap-4 text-[11px]">
          <div>
            <p className="font-serif font-bold tracking-[0.06em] uppercase">Invoice No:</p>
            <p className="mt-1 text-[18px] font-black tabular-nums tracking-wide">{inv}</p>
            <p className="mt-2 text-[10px] font-semibold text-[#444]">
              {new Date(receipt.soldAt).toLocaleString()} · {pay}
            </p>
          </div>
          <div className="space-y-2 font-serif text-[11px]">
            <div className="flex gap-2 border-b border-[#1a1a1a]/35 pb-1">
              <span className="shrink-0 font-bold tracking-wide uppercase">Name:</span>
              <span className="min-w-0 flex-1 font-semibold">{name || "\u00a0"}</span>
            </div>
            <div className="flex gap-2 border-b border-[#1a1a1a]/35 pb-1">
              <span className="shrink-0 font-bold tracking-wide uppercase">Ph No:</span>
              <span className="min-w-0 flex-1 font-semibold">{phone || "\u00a0"}</span>
            </div>
            <div className="flex gap-2 border-b border-[#1a1a1a]/35 pb-1">
              <span className="shrink-0 font-bold tracking-wide uppercase">Address:</span>
              <span className="min-w-0 flex-1 font-semibold">{address || "\u00a0"}</span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <table className="mt-5 w-full border-collapse text-[11px] border-2 border-[#1a1a1a]">
          <thead>
            <tr className="font-serif text-[10px] uppercase tracking-wide">
              <th className="border border-[#1a1a1a] px-1.5 py-2 text-left font-bold">Description</th>
              <th className="border border-[#1a1a1a] px-1 py-2 text-center font-bold w-[12%]">Qty</th>
              <th className="border border-[#1a1a1a] px-1 py-2 text-right font-bold w-[22%]">Price</th>
              <th className="border border-[#1a1a1a] px-1.5 py-2 text-right font-bold w-[24%]">Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((line, idx) => (
              <tr key={`${line.productName}-${line.size}-${idx}`}>
                <td className="border border-[#1a1a1a] px-1.5 py-2 align-top font-semibold leading-snug">
                  {line.productName}
                  <span className="mt-0.5 block text-[10px] font-bold text-[#333]">
                    {[line.colorName, line.size ? `Sz ${line.size}` : null, line.productCode]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className="border border-[#1a1a1a] px-1 py-2 text-center align-top font-bold tabular-nums">
                  {line.quantity}
                </td>
                <td className="border border-[#1a1a1a] px-1 py-2 text-right align-top font-bold tabular-nums whitespace-nowrap">
                  {formatMMK(line.unitPrice)}
                </td>
                <td className="border border-[#1a1a1a] px-1.5 py-2 text-right align-top font-bold tabular-nums whitespace-nowrap">
                  {formatMMK(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total amount box */}
        <div className="mt-0 flex justify-end">
          <div className="grid w-[62%] max-w-[280px] grid-cols-[1fr_1.1fr] border-2 border-t-0 border-[#1a1a1a] text-[11px]">
            <div className="border-r-2 border-[#1a1a1a] px-2 py-2.5 text-center font-serif font-bold uppercase tracking-wide">
              Total Amount
            </div>
            <div className="px-2 py-2.5 text-right text-[15px] font-black tabular-nums">
              {formatMMK(receipt.total)}
            </div>
          </div>
        </div>

        {note && <p className="mt-3 text-[11px] font-semibold text-[#333]">Note: {note}</p>}

        {/* Footer */}
        <div className="mt-6 flex items-start justify-between gap-3 text-[10px] font-bold">
          <div className="flex items-start gap-1.5 min-w-0">
            <HomeIcon className="mt-0.5 shrink-0" />
            <span className="leading-snug">{STORE_ADDRESS}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ChatIcon />
            <span>{STORE_MESSENGER}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Test receipt for hardware check (no sale required). */
export function buildTestReceipt(): ReceiptData {
  return {
    saleId: "00000000-test-print-xp80",
    soldAt: new Date().toISOString(),
    total: 275000,
    paymentMethod: "cash",
    notes: "TEST PRINT · XP-80C",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    items: [
      {
        productName: "Ribbed Zip Jacket",
        productCode: "SO1pljk",
        colorName: "Black",
        size: "M",
        quantity: 1,
        unitPrice: 185000,
        lineTotal: 185000,
      },
      {
        productName: "Scoop Sports Bra",
        productCode: "SO3prtp",
        colorName: "Caramel",
        size: "S",
        quantity: 1,
        unitPrice: 90000,
        lineTotal: 90000,
      },
    ],
  };
}

/** Same logo paths as logo-clover.svg — stroke kept for thermal visibility only via color. */
const CLOVER_SVG_MARK = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="36" height="36" fill="none" aria-hidden="true">
  <path stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    d="M24 8 C30 8 34 12 34 18 C34 24 30 28 24 28 C18 28 14 24 14 18 C14 12 18 8 24 8 Z
       M24 20 C30 20 34 24 34 30 C34 36 30 40 24 40 C18 40 14 36 14 30 C14 24 18 20 24 20 Z" />
  <path stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    d="M40 24 C40 30 36 34 30 34 C24 34 20 30 20 24 C20 18 24 14 30 14 C36 14 40 18 40 24 Z
       M28 24 C28 30 24 34 18 34 C12 34 8 30 8 24 C8 18 12 14 18 14 C24 14 28 18 28 24 Z" />
</svg>`;

const PHONE_SVG = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden="true"><path d="M6.5 3.5h3l1.2 4.2-2 1.2a12 12 0 0 0 5.4 5.4l1.2-2 4.2 1.2v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 5 5.1 1.5 1.5 0 0 1 6.5 3.5Z" stroke="#000" stroke-width="2" stroke-linejoin="round"/></svg>`;
const HOME_SVG = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="#000" stroke-width="2" stroke-linejoin="round"/></svg>`;
const CHAT_SVG = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden="true"><path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6A3.5 3.5 0 0 1 15.5 16H11l-4 3.5V16H8.5A3.5 3.5 0 0 1 5 12.5v-6Z" stroke="#000" stroke-width="2" stroke-linejoin="round"/></svg>`;

/**
 * Thermal print HTML — invoice layout, bold black type for XP-80C.
 */
function buildReceiptPrintHtml(receipt: ReceiptData, paperMm: PaperWidthMm) {
  const inv = invoiceNo(receipt.saleId);
  const when = new Date(receipt.soldAt).toLocaleString();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const printW = printableWidthMm(paperMm);
  const isNarrow = printW <= 52;
  const body = isNarrow ? 11 : 12;
  const small = isNarrow ? 10 : 11;
  const brand = isNarrow ? 13 : 15;
  const name = escapeHtml(receipt.customerName?.trim() || "");
  const phone = escapeHtml(receipt.customerPhone?.trim() || "");
  const address = escapeHtml(receipt.customerAddress?.trim() || "");
  const note = noteClean(receipt.notes);

  const rows = receipt.items
    .map((line) => {
      const desc = escapeHtml(line.productName);
      const meta = escapeHtml(
        [line.colorName, line.size ? `Sz ${line.size}` : null, line.productCode]
          .filter(Boolean)
          .join(" · ")
      );
      return `<tr>
        <td class="c desc"><div class="dn">${desc}</div>${meta ? `<div class="dm">${meta}</div>` : ""}</td>
        <td class="c qty">${line.quantity}</td>
        <td class="c price">${formatMMK(line.unitPrice)}</td>
        <td class="c tot">${formatMMK(line.lineTotal)}</td>
      </tr>`;
    })
    .join("");

  // Pad to at least 3 rows so the grid still looks like the invoice
  const padCount = Math.max(0, 3 - receipt.items.length);
  const pads = Array.from({ length: padCount }, () =>
    `<tr><td class="c desc">&nbsp;</td><td class="c qty">&nbsp;</td><td class="c price">&nbsp;</td><td class="c tot">&nbsp;</td></tr>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>THE CLOVER Invoice ${inv}</title>
  <style>
    @page { size: ${paperMm}mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${body}px;
      font-weight: 700;
      line-height: 1.3;
      width: ${printW}mm;
      max-width: ${printW}mm;
      padding: 2mm 1.5mm 4mm;
      color: #000;
      text-shadow: 0.3px 0 0 #000, -0.3px 0 0 #000;
      -webkit-font-smoothing: none;
    }
    .hdr {
      display: table; width: 100%; table-layout: fixed; margin-bottom: 8px;
    }
    .hdr .col { display: table-cell; vertical-align: top; }
    .hdr .logo { width: 38px; }
    .hdr .brand { text-align: center; padding: 0 4px; }
    .hdr .phones { width: 78px; text-align: right; font-size: ${small}px; font-weight: 800; }
    .brand-name {
      font-family: Georgia, "Times New Roman", serif;
      font-size: ${brand}px; font-weight: 900;
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    .brand-sub {
      font-family: Georgia, "Times New Roman", serif;
      font-size: ${small}px; font-style: italic; font-weight: 700; margin-top: 2px;
    }
    .phone-row { display: flex; justify-content: flex-end; align-items: flex-start; gap: 3px; }
    .meta {
      display: table; width: 100%; table-layout: fixed; margin: 10px 0 8px;
      font-size: ${small}px; font-weight: 800;
    }
    .meta .l, .meta .r { display: table-cell; vertical-align: top; }
    .meta .l { width: 42%; }
    .inv-lbl { text-transform: uppercase; letter-spacing: 0.04em; font-weight: 900; }
    .inv-no { font-size: ${isNarrow ? 16 : 18}px; font-weight: 900; margin-top: 2px; }
    .inv-when { font-size: ${small - 1}px; margin-top: 4px; font-weight: 700; }
    .cust-line {
      border-bottom: 1.5px solid #000; padding: 3px 0 2px; margin-bottom: 4px;
      min-height: 14px;
    }
    .cust-line .k { text-transform: uppercase; font-weight: 900; margin-right: 4px; }
    table.items {
      width: 100%; border-collapse: collapse; table-layout: fixed;
      border: 2px solid #000; margin-top: 4px;
    }
    table.items th, table.items td {
      border: 1.5px solid #000; padding: 4px 3px; font-weight: 800; vertical-align: top;
    }
    table.items th {
      font-size: ${small}px; text-transform: uppercase; letter-spacing: 0.03em;
      font-family: Georgia, "Times New Roman", serif;
    }
    .col-d { width: 40%; } .col-q { width: 12%; } .col-p { width: 24%; } .col-t { width: 24%; }
    th.qty, td.qty { text-align: center; }
    th.price, td.price, th.tot, td.tot { text-align: right; white-space: nowrap; }
    td.desc { text-align: left; word-wrap: break-word; overflow-wrap: anywhere; }
    .dn { font-weight: 900; } .dm { font-size: ${small - 1}px; font-weight: 700; margin-top: 1px; }
    .total-wrap { display: flex; justify-content: flex-end; }
    .total-box {
      width: 62%; border: 2px solid #000; border-top: none;
      display: table; table-layout: fixed; font-weight: 900;
    }
    .total-box .a, .total-box .b { display: table-cell; padding: 6px 4px; vertical-align: middle; }
    .total-box .a {
      width: 48%; border-right: 2px solid #000; text-align: center;
      font-size: ${small}px; text-transform: uppercase;
      font-family: Georgia, "Times New Roman", serif;
    }
    .total-box .b { text-align: right; font-size: ${isNarrow ? 13 : 15}px; }
    .note { margin-top: 8px; font-size: ${small}px; font-weight: 800; }
    .foot {
      display: table; width: 100%; margin-top: 14px; font-size: ${small - 1}px; font-weight: 800;
    }
    .foot .fl, .foot .fr { display: table-cell; vertical-align: top; }
    .foot .fr { text-align: right; white-space: nowrap; }
    .ico { display: inline-block; vertical-align: -1px; margin-right: 3px; }
    .hint {
      text-align: center; font-size: 9px; font-weight: 800; margin-top: 10px;
      border-top: 1.5px dashed #000; padding-top: 6px;
    }
    @media print {
      .hint { display: none !important; }
      html, body { width: ${printW}mm !important; max-width: ${printW}mm !important; }
    }
  </style>
</head>
<body>
  <div class="hdr">
    <div class="col logo">${CLOVER_SVG_MARK}</div>
    <div class="col brand">
      <div class="brand-name">THE CLOVER</div>
      <div class="brand-sub">Sportswear</div>
    </div>
    <div class="col phones">
      <div class="phone-row">
        <span>${PHONE_SVG}</span>
        <span>${STORE_PHONES.map((p) => escapeHtml(p)).join("<br/>")}</span>
      </div>
    </div>
  </div>

  <div class="meta">
    <div class="l">
      <div class="inv-lbl">Invoice No:</div>
      <div class="inv-no">${inv}</div>
      <div class="inv-when">${escapeHtml(when)} · ${escapeHtml(pay)}</div>
    </div>
    <div class="r">
      <div class="cust-line"><span class="k">Name:</span>${name || "&nbsp;"}</div>
      <div class="cust-line"><span class="k">Ph No:</span>${phone || "&nbsp;"}</div>
      <div class="cust-line"><span class="k">Address:</span>${address || "&nbsp;"}</div>
    </div>
  </div>

  <table class="items">
    <colgroup>
      <col class="col-d" /><col class="col-q" /><col class="col-p" /><col class="col-t" />
    </colgroup>
    <thead>
      <tr>
        <th class="desc">Description</th>
        <th class="qty">Qty</th>
        <th class="price">Price</th>
        <th class="tot">Total</th>
      </tr>
    </thead>
    <tbody>${rows}${pads}</tbody>
  </table>

  <div class="total-wrap">
    <div class="total-box">
      <div class="a">Total Amount</div>
      <div class="b">${formatMMK(receipt.total)}</div>
    </div>
  </div>

  ${note ? `<p class="note">Note: ${escapeHtml(note)}</p>` : ""}

  <div class="foot">
    <div class="fl"><span class="ico">${HOME_SVG}</span>${escapeHtml(STORE_ADDRESS)}</div>
    <div class="fr"><span class="ico">${CHAT_SVG}</span>${escapeHtml(STORE_MESSENGER)}</div>
  </div>

  <p class="hint">XP-80C · ${paperMm}mm · scale 100% · margins None</p>
</body>
</html>`;
}

function triggerPrintInDocument(doc: Document, win?: Window | null) {
  const run = () => {
    try {
      win?.focus();
      doc.defaultView?.focus();
      (win || doc.defaultView)?.print();
    } catch {
      window.print();
    }
  };
  setTimeout(run, 200);
}

/**
 * Print receipt on any PC printer (USB, Bluetooth, or network) via the OS print dialog.
 */
export function printReceipt(receipt: ReceiptData, paperMm: PaperWidthMm = 80) {
  const html = buildReceiptPrintHtml(receipt, paperMm);

  const win = window.open("", "_blank", "width=480,height=760");
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* ignore */
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    triggerPrintInDocument(win.document, win);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print receipt");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!idoc) {
    document.body.removeChild(iframe);
    alert("Could not open the print dialog. Allow pop-ups for this site, then try Print again.");
    return;
  }

  idoc.open();
  idoc.write(html);
  idoc.close();
  triggerPrintInDocument(idoc, iframe.contentWindow);

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* already removed */
    }
  };
  iframe.contentWindow?.addEventListener?.("afterprint", cleanup);
  setTimeout(cleanup, 120_000);
}

function loadLogoImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      const svg = new Image();
      svg.onload = () => resolve(svg);
      svg.onerror = () => resolve(null);
      svg.src = `${window.location.origin}/assets/logo-clover.svg`;
    };
    img.src = `${window.location.origin}/assets/logo-icon.png`;
  });
}

/** Draw clover from official paths when image fails. */
function drawCloverFallback(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(1.4, r * 0.07);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const leaf = (ox: number, oy: number) => {
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, r * 0.38, r * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
  };
  leaf(0, -r * 0.32);
  leaf(0, r * 0.32);
  leaf(-r * 0.32, 0);
  leaf(r * 0.32, 0);
  ctx.restore();
}

/**
 * PNG export for phone printers — same invoice layout, bold black.
 */
export async function downloadReceiptPng(
  receipt: ReceiptData,
  paperMm: PaperWidthMm = 80
): Promise<File | null> {
  const dpi = 203;
  const printMm = printableWidthMm(paperMm);
  const W = Math.round((printMm / 25.4) * dpi);
  const pad = Math.round(W * 0.04);
  const fs = Math.round(W * 0.038);
  const fsSm = Math.round(W * 0.032);
  const fsBrand = Math.round(W * 0.05);
  const fsInv = Math.round(W * 0.055);
  const logoSize = Math.round(W * 0.12);
  const inv = invoiceNo(receipt.saleId);
  const when = new Date(receipt.soldAt).toLocaleString();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const note = noteClean(receipt.notes);
  const shortId = receipt.saleId.slice(0, 8).toUpperCase();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  const rowH = Math.round(fs * 2.4);
  const headerH = logoSize + 8;
  const metaH = Math.round(fs * 7);
  const tableHead = Math.round(fs * 1.8);
  const itemRows = Math.max(3, receipt.items.length);
  const tableH = tableHead + itemRows * rowH;
  const totalH = Math.round(fs * 2.2);
  const footH = Math.round(fs * 3);
  const noteH = note ? Math.round(fs * 2) : 0;
  canvas.height = pad * 2 + headerH + metaH + tableH + totalH + noteH + footH + 20;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    alert("Could not create receipt image");
    return null;
  }

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.textBaseline = "top";

  const bold = (size: number, weight = "800") => {
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  };
  const serif = (size: number, weight = "700", italic = false) => {
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px Georgia, "Times New Roman", serif`;
  };
  const strokeText = (t: string, x: number, y: number, maxW?: number) => {
    ctx.fillText(t, x, y, maxW);
    ctx.fillText(t, x + 0.5, y, maxW);
  };

  const logo = await loadLogoImage();
  let y = pad;

  // Header
  if (logo) {
    ctx.drawImage(logo, pad, y, logoSize, logoSize);
  } else {
    drawCloverFallback(ctx, pad + logoSize / 2, y + logoSize / 2, logoSize * 0.42);
  }
  serif(fsBrand, "900");
  ctx.textAlign = "center";
  strokeText("THE CLOVER", W / 2, y + 4);
  serif(fsSm, "700", true);
  strokeText("Sportswear", W / 2, y + 4 + fsBrand + 2);

  bold(fsSm, "800");
  ctx.textAlign = "right";
  let py = y + 2;
  for (const p of STORE_PHONES) {
    strokeText(p, W - pad, py);
    py += fsSm + 2;
  }

  y += headerH + 10;

  // Meta
  bold(fsSm, "900");
  ctx.textAlign = "left";
  strokeText("INVOICE NO:", pad, y);
  bold(fsInv, "900");
  strokeText(inv, pad, y + fsSm + 4);
  bold(fsSm - 1, "700");
  strokeText(`${when} · ${pay}`, pad, y + fsSm + 4 + fsInv + 4, W * 0.42);

  const custX = W * 0.45;
  const custW = W - pad - custX;
  const custLines: [string, string][] = [
    ["NAME:", receipt.customerName?.trim() || ""],
    ["PH NO:", receipt.customerPhone?.trim() || ""],
    ["ADDRESS:", receipt.customerAddress?.trim() || ""],
  ];
  let cy = y;
  for (const [k, v] of custLines) {
    bold(fsSm, "900");
    ctx.textAlign = "left";
    strokeText(k, custX, cy);
    const kx = custX + ctx.measureText(k + " ").width;
    bold(fsSm, "700");
    strokeText(v, kx, cy, custW - (kx - custX));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(custX, cy + fsSm + 3);
    ctx.lineTo(W - pad, cy + fsSm + 3);
    ctx.stroke();
    cy += fsSm + 10;
  }

  y += metaH;

  // Table
  const cols = [
    { key: "d", x: pad, w: (W - pad * 2) * 0.4 },
    { key: "q", x: 0, w: (W - pad * 2) * 0.12 },
    { key: "p", x: 0, w: (W - pad * 2) * 0.24 },
    { key: "t", x: 0, w: (W - pad * 2) * 0.24 },
  ];
  cols[1].x = cols[0].x + cols[0].w;
  cols[2].x = cols[1].x + cols[1].w;
  cols[3].x = cols[2].x + cols[2].w;

  const tableX = pad;
  const tableW = W - pad * 2;
  ctx.lineWidth = 2;
  ctx.strokeRect(tableX, y, tableW, tableH);

  // header row
  serif(fsSm, "800");
  ctx.textAlign = "left";
  strokeText("DESCRIPTION", cols[0].x + 3, y + 5, cols[0].w - 6);
  ctx.textAlign = "center";
  strokeText("QTY", cols[1].x + cols[1].w / 2, y + 5);
  ctx.textAlign = "right";
  strokeText("PRICE", cols[2].x + cols[2].w - 3, y + 5);
  strokeText("TOTAL", cols[3].x + cols[3].w - 3, y + 5);

  // vertical + header line
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tableX, y + tableHead);
  ctx.lineTo(tableX + tableW, y + tableHead);
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(cols[i].x, y);
    ctx.lineTo(cols[i].x, y + tableH);
  }
  ctx.stroke();

  const lines = [...receipt.items];
  while (lines.length < 3) {
    lines.push({
      productName: "",
      colorName: "",
      size: "",
      quantity: 0,
      unitPrice: 0,
      lineTotal: 0,
    });
  }

  lines.forEach((line, i) => {
    const ry = y + tableHead + i * rowH;
    ctx.beginPath();
    ctx.moveTo(tableX, ry);
    ctx.lineTo(tableX + tableW, ry);
    ctx.stroke();
    if (!line.productName) return;
    bold(fsSm, "800");
    ctx.textAlign = "left";
    strokeText(line.productName, cols[0].x + 3, ry + 4, cols[0].w - 6);
    const meta = [line.colorName, line.size ? `Sz ${line.size}` : null]
      .filter(Boolean)
      .join(" · ");
    if (meta) {
      bold(fsSm - 2, "700");
      strokeText(meta, cols[0].x + 3, ry + 4 + fsSm, cols[0].w - 6);
    }
    bold(fsSm, "800");
    ctx.textAlign = "center";
    strokeText(String(line.quantity), cols[1].x + cols[1].w / 2, ry + 6);
    ctx.textAlign = "right";
    strokeText(formatMMK(line.unitPrice), cols[2].x + cols[2].w - 3, ry + 6);
    strokeText(formatMMK(line.lineTotal), cols[3].x + cols[3].w - 3, ry + 6);
  });

  y += tableH;

  // Total box
  const boxW = tableW * 0.62;
  const boxX = tableX + tableW - boxW;
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, y, boxW, totalH);
  ctx.beginPath();
  ctx.moveTo(boxX + boxW * 0.48, y);
  ctx.lineTo(boxX + boxW * 0.48, y + totalH);
  ctx.stroke();
  serif(fsSm, "800");
  ctx.textAlign = "center";
  strokeText("TOTAL AMOUNT", boxX + boxW * 0.24, y + totalH / 2 - fsSm / 2);
  bold(fs + 2, "900");
  ctx.textAlign = "right";
  strokeText(formatMMK(receipt.total), boxX + boxW - 4, y + totalH / 2 - (fs + 2) / 2);

  y += totalH + 8;
  if (note) {
    bold(fsSm, "800");
    ctx.textAlign = "left";
    strokeText(`Note: ${note}`, pad, y, W - pad * 2);
    y += noteH;
  }

  y += 8;
  bold(fsSm - 1, "800");
  ctx.textAlign = "left";
  strokeText(STORE_ADDRESS, pad + 14, y, W * 0.55);
  ctx.textAlign = "right";
  strokeText(STORE_MESSENGER, W - pad, y);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) {
    alert("Could not export PNG");
    return null;
  }

  const fileName = `clover-receipt-${shortId}-${paperMm}mm.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "THE CLOVER receipt",
        text: `Invoice ${inv}`,
      });
      return file;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return file;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return file;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
