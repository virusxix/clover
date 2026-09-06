"use client";

/**
 * THE CLOVER store receipt — classic thermal POS layout for XP-80C.
 * Dashed separators, no grid. Normal weight body; bold only for brand + total.
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
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  /** store = POS walk-in · website = online order */
  channel?: "store" | "website";
  shippingCents?: number;
  taxCents?: number;
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

/** Printable area inside the roll. */
function printableWidthMm(paperMm: PaperWidthMm): number {
  if (paperMm >= 210) return 190;
  if (paperMm >= 107) return 100;
  if (paperMm >= 80) return 72;
  if (paperMm >= 77) return 68;
  return 48;
}

const PAY_LABELS = PAYMENT_LABELS;
const PAPER_STORAGE_KEY = "clover-pos-paper-mm";

const STORE_PHONES = ["09791946536", "09666888627"];
const STORE_ADDRESS = "69*33 Corner Chan Aye Thar Zan";
const STORE_MESSENGER = "The Clover";

function receiptNo(saleId: string): string {
  const hex = saleId.replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16) % 100000;
  return String(Number.isFinite(n) ? n : 0).padStart(5, "0");
}

function noteClean(notes?: string) {
  return (notes || "").replace(/\s*·\s*pay:[a-z_]+/i, "").trim();
}

/** Amount without currency suffix — narrower on 80mm paper. */
function amt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

function itemsSubtotal(items: ReceiptItem[]) {
  return items.reduce((s, i) => s + (i.lineTotal || 0), 0);
}

/** Official clover mark — same paths as /assets/logo-clover.svg. */
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

/** On-screen preview — classic thermal receipt (no grids). Store ≠ website. */
export function PosReceipt({ receipt, className = "" }: Props) {
  const channel = receipt.channel === "website" ? "website" : "store";
  const isWeb = channel === "website";
  const no = receiptNo(receipt.saleId);
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const name = receipt.customerName?.trim() || "";
  const phone = receipt.customerPhone?.trim() || "";
  const address = receipt.customerAddress?.trim() || "";
  const note = noteClean(receipt.notes);
  const sub = itemsSubtotal(receipt.items);
  const shipping = receipt.shippingCents ?? 0;
  const tax = receipt.taxCents ?? 0;
  const other =
    shipping + tax > 0
      ? shipping + tax
      : Math.max(0, Math.round(receipt.total) - sub);
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div
      className={`pos-receipt mx-auto max-w-[320px] rounded-sm border border-neutral-300 bg-white text-black shadow-sm font-sans ${className}`}
      data-receipt
      data-channel={channel}
    >
      <div className="px-4 py-5 text-[12px] font-normal leading-snug">
        <header className="text-center">
          <div className="mx-auto mb-2 flex justify-center text-black">
            <CloverMark size={40} />
          </div>
          <p className="text-[15px] font-bold tracking-[0.12em] uppercase">THE CLOVER</p>
          <p className="mt-0.5 text-[11px] italic text-neutral-700">Sportswear</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-800">
            {isWeb ? "Online order" : "Store sale"}
          </p>
          <p className="mt-2 text-[11px] tabular-nums leading-relaxed text-neutral-800">
            {STORE_PHONES.join(" · ")}
          </p>
        </header>

        <Dash />

        <div className="space-y-0.5 text-[11px] text-neutral-800">
          <Row label={isWeb ? "Order #" : "Receipt #"} value={no} />
          <Row label="Date" value={new Date(receipt.soldAt).toLocaleString()} />
          <Row label="Payment" value={pay} />
          <Row label="Items" value={String(units)} />
          {isWeb && <Row label="Channel" value="Website" />}
          {!isWeb && <Row label="Channel" value="Store POS" />}
        </div>

        {isWeb && (name || phone || address) && (
          <>
            <Dash />
            <p className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Ship to</p>
            <div className="space-y-0.5 text-[11px] text-neutral-800">
              {name && <p>{name}</p>}
              {phone && <p>{phone}</p>}
              {address && <p className="break-words">{address}</p>}
            </div>
          </>
        )}

        {!isWeb && (name || phone) && (
          <>
            <Dash />
            <div className="space-y-0.5 text-[11px] text-neutral-800">
              {name && <p>Customer: {name}</p>}
              {phone && <p>Phone: {phone}</p>}
            </div>
          </>
        )}

        <Dash />

        <div className="flex justify-between text-[10px] uppercase tracking-wide mb-1 text-neutral-600">
          <span>Item</span>
          <span>Amount</span>
        </div>

        <div className="space-y-3">
          {receipt.items.map((line, idx) => (
            <div key={`${line.productName}-${line.size}-${idx}`}>
              <p className="font-medium leading-snug">{line.productName}</p>
              <p className="text-[11px] mt-0.5 text-neutral-600">
                {[line.colorName, line.size ? `Sz ${line.size}` : null, line.productCode]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-0.5 flex justify-between gap-2 tabular-nums text-[11px] text-neutral-800">
                <span>
                  {line.quantity} x {amt(line.unitPrice)}
                </span>
                <span className="shrink-0">{amt(line.lineTotal || line.unitPrice * line.quantity)}</span>
              </div>
            </div>
          ))}
        </div>

        <Dash />

        <div className="space-y-1 text-[12px] text-neutral-800">
          <Row label="Subtotal" value={amt(sub)} />
          {isWeb && shipping > 0 && <Row label="Shipping" value={amt(shipping)} />}
          {isWeb && tax > 0 && <Row label="Tax" value={amt(tax)} />}
          {!isWeb && other > 0 && <Row label="Other" value={amt(other)} />}
          {isWeb && shipping + tax === 0 && other > 0 && (
            <Row label="Shipping / tax" value={amt(other)} />
          )}
          <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-black mt-1">
            <span className="font-bold uppercase tracking-wide text-[11px]">Total</span>
            <span className="text-[16px] font-bold tabular-nums">{formatMMK(receipt.total)}</span>
          </div>
        </div>

        {note && !/^web order/i.test(note) && (
          <>
            <Dash />
            <p className="text-[11px] break-words text-neutral-700">{note}</p>
          </>
        )}

        <Dash />

        <p className="text-center text-[11px] mt-1">
          {isWeb ? "Thank you for your order" : "Thank you for shopping with us"}
        </p>
        {isWeb ? (
          <p className="text-center text-[10px] mt-2 text-neutral-700">
            We&apos;ll pack and ship soon
          </p>
        ) : (
          <p className="text-center text-[10px] mt-2 text-neutral-700">
            Paid in store · no shipping
          </p>
        )}
        <p className="text-center text-[10px] mt-2 leading-snug text-neutral-700">{STORE_ADDRESS}</p>
        <p className="text-center text-[10px] mt-1 text-neutral-700">Messenger: {STORE_MESSENGER}</p>
      </div>
    </div>
  );
}

function Dash() {
  return <div className="my-3 border-t border-dashed border-neutral-400" aria-hidden />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 font-normal">
      <span className="shrink-0 text-neutral-600">{label}</span>
      <span className="text-right min-w-0 break-words tabular-nums">{value}</span>
    </div>
  );
}

/** Test receipt for hardware check. */
export function buildTestReceipt(): ReceiptData {
  return {
    saleId: "00000000-test-print-xp80",
    soldAt: new Date().toISOString(),
    total: 275000,
    paymentMethod: "cash",
    channel: "store",
    notes: "TEST PRINT · Store POS",
    customerName: "Walk-in",
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

const CLOVER_SVG_MARK = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="38" height="38" fill="none" aria-hidden="true">
  <path stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    d="M24 8 C30 8 34 12 34 18 C34 24 30 28 24 28 C18 28 14 24 14 18 C14 12 18 8 24 8 Z
       M24 20 C30 20 34 24 34 30 C34 36 30 40 24 40 C18 40 14 36 14 30 C14 24 18 20 24 20 Z" />
  <path stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    d="M40 24 C40 30 36 34 30 34 C24 34 20 30 20 24 C20 18 24 14 30 14 C36 14 40 18 40 24 Z
       M28 24 C28 30 24 34 18 34 C12 34 8 30 8 24 C8 18 12 14 18 14 C24 14 28 18 28 24 Z" />
</svg>`;

/**
 * Classic thermal print HTML — store vs website layout. No grids.
 */
function buildReceiptPrintHtml(receipt: ReceiptData, paperMm: PaperWidthMm) {
  const channel = receipt.channel === "website" ? "website" : "store";
  const isWeb = channel === "website";
  const no = receiptNo(receipt.saleId);
  const when = new Date(receipt.soldAt).toLocaleString();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const printW = printableWidthMm(paperMm);
  const isNarrow = printW <= 52;
  const body = isNarrow ? 12 : 13;
  const small = isNarrow ? 11 : 12;
  const brand = isNarrow ? 14 : 16;
  const name = escapeHtml(receipt.customerName?.trim() || "");
  const phone = escapeHtml(receipt.customerPhone?.trim() || "");
  const address = escapeHtml(receipt.customerAddress?.trim() || "");
  const note = noteClean(receipt.notes);
  const sub = itemsSubtotal(receipt.items);
  const shipping = receipt.shippingCents ?? 0;
  const tax = receipt.taxCents ?? 0;
  const other =
    shipping + tax > 0
      ? shipping + tax
      : Math.max(0, Math.round(receipt.total) - sub);
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const idLabel = isWeb ? "Order #" : "Receipt #";
  const channelLabel = isWeb ? "Website" : "Store POS";
  const kindLabel = isWeb ? "ONLINE ORDER" : "STORE SALE";
  const thanks = isWeb ? "Thank you for your order" : "Thank you for shopping with us";
  const tagline = isWeb ? "We'll pack and ship soon" : "Paid in store · no shipping";

  const lines = receipt.items
    .map((line) => {
      const meta = [line.colorName, line.size ? `Sz ${line.size}` : null, line.productCode]
        .filter(Boolean)
        .join(" · ");
      const lineAmt = line.lineTotal || line.unitPrice * line.quantity;
      return `
      <div class="item">
        <div class="iname">${escapeHtml(line.productName)}</div>
        ${meta ? `<div class="imeta">${escapeHtml(meta)}</div>` : ""}
        <div class="irow">
          <span>${line.quantity} x ${amt(line.unitPrice)}</span>
          <span class="iamt">${amt(lineAmt)}</span>
        </div>
      </div>`;
    })
    .join("");

  let custBlock = "";
  if (isWeb && (name || phone || address)) {
    custBlock = `<div class="dash"></div>
      <div class="block">
        <div class="ship-lbl">Ship to</div>
        ${name ? `<div>${name}</div>` : ""}
        ${phone ? `<div>${phone}</div>` : ""}
        ${address ? `<div>${address}</div>` : ""}
      </div>`;
  } else if (!isWeb && (name || phone)) {
    custBlock = `<div class="dash"></div>
      <div class="block">
        ${name ? `<div>Customer: ${name}</div>` : ""}
        ${phone ? `<div>Phone: ${phone}</div>` : ""}
      </div>`;
  }

  const extraRows = isWeb
    ? `${shipping > 0 ? `<div class="row"><span class="k">Shipping</span><span class="v">${amt(shipping)}</span></div>` : ""}
       ${tax > 0 ? `<div class="row"><span class="k">Tax</span><span class="v">${amt(tax)}</span></div>` : ""}
       ${shipping + tax === 0 && other > 0 ? `<div class="row"><span class="k">Shipping / tax</span><span class="v">${amt(other)}</span></div>` : ""}`
    : other > 0
      ? `<div class="row"><span class="k">Other</span><span class="v">${amt(other)}</span></div>`
      : "";

  const noteHtml =
    note && !/^web order/i.test(note)
      ? `<div class="dash"></div><div class="block">${escapeHtml(note)}</div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>THE CLOVER ${isWeb ? "Order" : "Receipt"} #${no}</title>
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
      font-weight: 400;
      line-height: 1.4;
      width: ${printW}mm;
      max-width: ${printW}mm;
      padding: 3mm 2mm 5mm;
      color: #000;
    }
    .center { text-align: center; }
    .logo { margin: 0 auto 4px; display: block; }
    .brand {
      font-size: ${brand}px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .tag { font-size: ${small}px; font-style: italic; font-weight: 400; margin-top: 2px; }
    .kind {
      font-size: ${small - 1}px; font-weight: 600; letter-spacing: 0.14em;
      text-transform: uppercase; margin-top: 6px;
    }
    .phones { font-size: ${small}px; font-weight: 400; margin-top: 6px; }
    .dash {
      border: none;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .block { font-size: ${small}px; font-weight: 400; }
    .ship-lbl {
      font-size: ${small - 1}px; text-transform: uppercase; letter-spacing: 0.06em;
      color: #444; margin-bottom: 3px;
    }
    .row {
      display: flex; justify-content: space-between; gap: 8px;
      font-size: ${small}px; font-weight: 400; margin: 2px 0;
    }
    .row .k { color: #333; }
    .row .v { text-align: right; word-break: break-word; }
    .cols {
      display: flex; justify-content: space-between;
      font-size: ${small - 1}px; text-transform: uppercase;
      font-weight: 400; letter-spacing: 0.04em; margin-bottom: 4px;
      color: #444;
    }
    .item { margin: 0 0 8px; }
    .iname { font-weight: 600; font-size: ${body}px; word-break: break-word; }
    .imeta { font-size: ${small}px; font-weight: 400; margin-top: 1px; color: #333; }
    .irow {
      display: flex; justify-content: space-between; gap: 8px;
      margin-top: 2px; font-weight: 400; font-size: ${small}px;
    }
    .iamt { font-weight: 400; white-space: nowrap; }
    .total-row {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: 8px; margin-top: 6px; padding-top: 6px;
      border-top: 1px solid #000;
    }
    .total-row .lbl {
      font-size: ${small}px; text-transform: uppercase;
      letter-spacing: 0.06em; font-weight: 700;
    }
    .total-row .amt {
      font-size: ${isNarrow ? 15 : 17}px; white-space: nowrap; font-weight: 700;
    }
    .thanks { text-align: center; font-weight: 400; font-size: ${small}px; margin-top: 4px; }
    .tagline { text-align: center; font-size: ${small - 1}px; margin-top: 4px; color: #333; }
    .foot { text-align: center; font-size: ${small - 1}px; font-weight: 400; margin-top: 6px; line-height: 1.4; }
    .hint {
      text-align: center; font-size: 9px; font-weight: 400; margin-top: 10px;
      border-top: 1px dashed #999; padding-top: 6px; color: #666;
    }
    @media print {
      .hint { display: none !important; }
      html, body { width: ${printW}mm !important; max-width: ${printW}mm !important; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="logo">${CLOVER_SVG_MARK}</div>
    <div class="brand">THE CLOVER</div>
    <div class="tag">Sportswear</div>
    <div class="kind">${kindLabel}</div>
    <div class="phones">${STORE_PHONES.map(escapeHtml).join(" · ")}</div>
  </div>

  <div class="dash"></div>

  <div class="block">
    <div class="row"><span class="k">${idLabel}</span><span class="v">${no}</span></div>
    <div class="row"><span class="k">Date</span><span class="v">${escapeHtml(when)}</span></div>
    <div class="row"><span class="k">Payment</span><span class="v">${escapeHtml(pay)}</span></div>
    <div class="row"><span class="k">Items</span><span class="v">${units}</span></div>
    <div class="row"><span class="k">Channel</span><span class="v">${channelLabel}</span></div>
  </div>

  ${custBlock}

  <div class="dash"></div>
  <div class="cols"><span>Item</span><span>Amount</span></div>
  ${lines}

  <div class="dash"></div>
  <div class="block">
    <div class="row"><span class="k">Subtotal</span><span class="v">${amt(sub)}</span></div>
    ${extraRows}
    <div class="total-row">
      <span class="lbl">Total</span>
      <span class="amt">${formatMMK(receipt.total)}</span>
    </div>
  </div>

  ${noteHtml}

  <div class="dash"></div>
  <p class="thanks">${thanks}</p>
  <p class="tagline">${tagline}</p>
  <p class="foot">${escapeHtml(STORE_ADDRESS)}<br/>Messenger: ${escapeHtml(STORE_MESSENGER)}</p>
  <p class="hint">${isWeb ? "Website order" : "Store POS"} · XP-80C · ${paperMm}mm</p>
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

/** Print via OS dialog (USB / Bluetooth / network). */
export function printReceipt(receipt: ReceiptData, paperMm: PaperWidthMm = 80) {
  const html = buildReceiptPrintHtml(receipt, paperMm);

  const win = window.open("", "_blank", "width=420,height=720");
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

/** PNG export — classic receipt layout for phone printers. */
export async function downloadReceiptPng(
  receipt: ReceiptData,
  paperMm: PaperWidthMm = 80
): Promise<File | null> {
  const dpi = 203;
  const printMm = printableWidthMm(paperMm);
  const W = Math.round((printMm / 25.4) * dpi);
  const pad = Math.round(W * 0.05);
  const fs = Math.round(W * 0.042);
  const fsSm = Math.round(W * 0.036);
  const fsBrand = Math.round(W * 0.052);
  const fsTotal = Math.round(W * 0.056);
  const logoSize = Math.round(W * 0.14);
  const no = receiptNo(receipt.saleId);
  const when = new Date(receipt.soldAt).toLocaleString();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const note = noteClean(receipt.notes);
  const sub = itemsSubtotal(receipt.items);
  const other = Math.max(0, Math.round(receipt.total) - sub);
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const shortId = receipt.saleId.slice(0, 8).toUpperCase();

  type Op =
    | { k: "gap"; h: number }
    | { k: "text"; t: string; s: number; w: string; a: CanvasTextAlign }
    | { k: "logo" }
    | { k: "dash" }
    | { k: "pair"; left: string; right: string; s: number };

  const ops: Op[] = [];
  const text = (t: string, s = fs, w = "400", a: CanvasTextAlign = "left") =>
    ops.push({ k: "text", t, s, w, a });
  const gap = (h: number) => ops.push({ k: "gap", h });
  const pair = (left: string, right: string, s = fsSm) => ops.push({ k: "pair", left, right, s });

  ops.push({ k: "logo" });
  gap(6);
  text("THE CLOVER", fsBrand, "700", "center");
  gap(2);
  text("Sportswear", fsSm, "400", "center");
  gap(4);
  text(receipt.channel === "website" ? "ONLINE ORDER" : "STORE SALE", fsSm, "600", "center");
  gap(6);
  text(STORE_PHONES.join(" · "), fsSm, "400", "center");
  gap(4);
  ops.push({ k: "dash" });
  gap(4);
  pair(receipt.channel === "website" ? "Order #" : "Receipt #", no);
  pair("Date", when);
  pair("Payment", pay);
  pair("Items", String(units));
  pair("Channel", receipt.channel === "website" ? "Website" : "Store POS");

  if (receipt.customerName?.trim() || receipt.customerPhone?.trim() || receipt.customerAddress?.trim()) {
    gap(4);
    ops.push({ k: "dash" });
    gap(4);
    if (receipt.customerName?.trim()) text(`Name: ${receipt.customerName.trim()}`, fsSm, "400");
    if (receipt.customerPhone?.trim()) text(`Phone: ${receipt.customerPhone.trim()}`, fsSm, "400");
    if (receipt.customerAddress?.trim()) text(`Addr: ${receipt.customerAddress.trim()}`, fsSm, "400");
  }

  gap(4);
  ops.push({ k: "dash" });
  gap(4);
  pair("ITEM", "AMOUNT", fsSm);

  for (const item of receipt.items) {
    gap(6);
    text(item.productName, fs, "600");
    const meta = [item.colorName, item.size ? `Sz ${item.size}` : null, item.productCode]
      .filter(Boolean)
      .join(" · ");
    if (meta) text(meta, fsSm, "400");
    pair(`${item.quantity} x ${amt(item.unitPrice)}`, amt(item.lineTotal), fsSm);
  }

  gap(4);
  ops.push({ k: "dash" });
  gap(4);
  pair("Subtotal", amt(sub));
  if (other > 0) pair("Shipping / tax", amt(other));
  gap(4);
  text(`TOTAL  ${formatMMK(receipt.total)}`, fsTotal, "700", "center");

  if (note) {
    gap(6);
    ops.push({ k: "dash" });
    gap(4);
    text(note, fsSm, "400");
  }

  gap(6);
  ops.push({ k: "dash" });
  gap(6);
  text("Thank you for shopping", fsSm, "400", "center");
  gap(6);
  text(STORE_ADDRESS, fsSm - 1, "400", "center");
  gap(2);
  text(`Messenger: ${STORE_MESSENGER}`, fsSm - 1, "400", "center");

  const logo = await loadLogoImage();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  let height = pad * 2;
  for (const op of ops) {
    if (op.k === "gap") height += op.h;
    else if (op.k === "text" || op.k === "pair") height += (op.k === "text" ? op.s : op.s) * 1.45;
    else if (op.k === "logo") height += logoSize + 4;
    else if (op.k === "dash") height += 10;
  }
  canvas.height = Math.ceil(height);

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

  let y = pad;
  for (const op of ops) {
    if (op.k === "gap") {
      y += op.h;
      continue;
    }
    if (op.k === "logo") {
      const lx = (W - logoSize) / 2;
      if (logo) ctx.drawImage(logo, lx, y, logoSize, logoSize);
      else drawCloverFallback(ctx, W / 2, y + logoSize / 2, logoSize * 0.42);
      y += logoSize + 4;
      continue;
    }
    if (op.k === "dash") {
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(pad, y + 4);
      ctx.lineTo(W - pad, y + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      y += 10;
      continue;
    }
    if (op.k === "pair") {
      ctx.font = `400 ${op.s}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(op.left, pad, y, W * 0.55);
      ctx.textAlign = "right";
      ctx.fillText(op.right, W - pad, y, W * 0.45);
      y += op.s * 1.45;
      continue;
    }
    ctx.font = `${op.w} ${op.s}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = op.a;
    const x = op.a === "center" ? W / 2 : op.a === "right" ? W - pad : pad;
    ctx.fillText(op.t, x, y, W - pad * 2);
    y += op.s * 1.45;
  }

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
        text: `Receipt #${no}`,
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
