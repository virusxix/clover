"use client";

/**
 * THE CLOVER store receipt — classic thermal POS layout for XP-80C.
 * Dashed separators, no grid. Normal weight body; bold only for brand + total.
 * Uses official /assets/logo-icon.png (not the decorative SVG).
 */

import { formatMMK } from "@/lib/currency";
import { PAYMENT_LABELS } from "@/lib/payments";
import { CLOVER_LOGO_DATA_URL } from "./clover-logo-data";

export type ReceiptItem = {
  variantId?: string;
  productName: string;
  productCode?: string | null;
  colorName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  /** Per-line discount in MMK (seller-entered). */
  discount?: number;
  lineTotal: number;
};

export type ReceiptData = {
  saleId: string;
  soldAt: string;
  total: number;
  /** Gross merchandise subtotal before discounts (MMK). */
  subtotal?: number;
  /** Sum of per-line discounts (MMK). */
  itemDiscount?: number;
  /** Order-level discount off the sale (MMK). */
  discount?: number;
  notes?: string;
  paymentMethod?: string;
  /** Website orders: true only after real money marked received */
  paymentReceived?: boolean;
  paymentReceivedAt?: string | null;
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
  return items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
}

function itemsLineDiscountTotal(items: ReceiptItem[]) {
  return items.reduce((s, i) => s + Math.max(0, Math.round(i.discount || 0)), 0);
}

function receiptSubtotal(receipt: ReceiptData) {
  if (receipt.subtotal != null && Number.isFinite(receipt.subtotal)) {
    return Math.round(receipt.subtotal);
  }
  return itemsSubtotal(receipt.items);
}

function receiptItemDiscount(receipt: ReceiptData) {
  if (receipt.itemDiscount != null && Number.isFinite(receipt.itemDiscount)) {
    return Math.max(0, Math.round(receipt.itemDiscount));
  }
  return itemsLineDiscountTotal(receipt.items);
}

function receiptOrderDiscount(receipt: ReceiptData) {
  if (receipt.discount != null && Number.isFinite(receipt.discount)) {
    return Math.max(0, Math.round(receipt.discount));
  }
  return 0;
}

function unitsLabel(units: number) {
  return units === 1 ? "Item" : "Items";
}

/** Official brand mark — same asset as site header (/assets/logo-icon.png). */
function CloverMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CLOVER_LOGO_DATA_URL}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`}
      draggable={false}
    />
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
  const sub = receiptSubtotal(receipt);
  const itemDiscount = receiptItemDiscount(receipt);
  const orderDiscount = receiptOrderDiscount(receipt);
  const shipping = receipt.shippingCents ?? 0;
  const tax = receipt.taxCents ?? 0;
  const other =
    shipping + tax > 0
      ? shipping + tax
      : Math.max(0, Math.round(receipt.total) - (sub - itemDiscount - orderDiscount));
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
          <p className="mt-0.5 text-[11px] italic text-black">Sportswear</p>
          <p className="mt-2 inline-block border-2 border-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black">
            {isWeb ? "Online order · Packing slip" : "Store receipt"}
          </p>
          <p className="mt-2 text-[11px] tabular-nums leading-relaxed text-black">
            {STORE_PHONES.join(" · ")}
          </p>
        </header>

        <Dash />

        <div className="space-y-0.5 text-[11px] text-black">
          <Row label={isWeb ? "Order #" : "Receipt #"} value={no} />
          <Row label="Date" value={new Date(receipt.soldAt).toLocaleString()} />
          <Row label="Payment" value={pay} />
          {isWeb && (
            <Row
              label="Money"
              value={receipt.paymentReceived ? "RECEIVED" : "UNPAID — collect on delivery"}
            />
          )}
          <Row label={unitsLabel(units)} value={String(units)} />
          {isWeb && <Row label="Channel" value="Website" />}
          {!isWeb && <Row label="Channel" value="Store POS" />}
        </div>

        {isWeb && (name || phone || address) && (
          <>
            <Dash />
            <p className="text-[10px] uppercase tracking-wide text-black mb-1">Ship to</p>
            <div className="space-y-0.5 text-[11px] text-black">
              {name && <p>{name}</p>}
              {phone && <p>{phone}</p>}
              {address && <p className="break-words">{address}</p>}
            </div>
          </>
        )}

        {!isWeb && (name || phone) && (
          <>
            <Dash />
            <div className="space-y-0.5 text-[11px] text-black">
              {name && <p>Customer: {name}</p>}
              {phone && <p>Phone: {phone}</p>}
            </div>
          </>
        )}

        <Dash />

        <div className="flex justify-between text-[10px] uppercase tracking-wide mb-1 text-black">
          <span>{unitsLabel(units)}</span>
          <span>Amount</span>
        </div>

        <div className="space-y-3">
          {receipt.items.map((line, idx) => {
            const lineDisc = Math.max(0, Math.round(line.discount || 0));
            const lineGross = line.unitPrice * line.quantity;
            const lineNet = line.lineTotal ?? lineGross - lineDisc;
            return (
              <div key={`${line.productName}-${line.size}-${idx}`}>
                <p className="font-semibold leading-snug text-black">{line.productName}</p>
                <p className="text-[11px] mt-0.5 text-black">
                  {[line.colorName, line.size ? `Sz ${line.size}` : null, line.productCode]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-0.5 flex justify-between gap-2 tabular-nums text-[11px] text-black">
                  <span>
                    {line.quantity} x {amt(line.unitPrice)}
                  </span>
                  <span className="shrink-0">{amt(lineGross)}</span>
                </div>
                {lineDisc > 0 && (
                  <div className="flex justify-between gap-2 tabular-nums text-[11px] text-black">
                    <span>Discount</span>
                    <span className="shrink-0">−{amt(lineDisc)}</span>
                  </div>
                )}
                {lineDisc > 0 && (
                  <div className="flex justify-between gap-2 tabular-nums text-[11px] font-semibold text-black">
                    <span>Line total</span>
                    <span className="shrink-0">{amt(lineNet)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Dash />

        <div className="space-y-1 text-[12px] text-black">
          <Row label="Subtotal" value={amt(sub)} />
          {itemDiscount > 0 && <Row label="Item discounts" value={`−${amt(itemDiscount)}`} />}
          {orderDiscount > 0 && <Row label="Order discount" value={`−${amt(orderDiscount)}`} />}
          {isWeb && shipping > 0 && <Row label="Shipping" value={amt(shipping)} />}
          {isWeb && tax > 0 && <Row label="Tax" value={amt(tax)} />}
          {!isWeb && other > 0 && itemDiscount === 0 && orderDiscount === 0 && (
            <Row label="Other" value={amt(other)} />
          )}
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
            <p className="text-[11px] break-words text-black">{note}</p>
          </>
        )}

        <Dash />

        <p className="text-center text-[11px] mt-1 text-black">
          {isWeb ? "Thank you for your order" : "Thank you for shopping with us"}
        </p>
        {isWeb ? (
          <p className="text-center text-[10px] mt-2 text-black">
            We&apos;ll pack and ship soon
          </p>
        ) : (
          <p className="text-center text-[10px] mt-2 text-black">
            Paid in store · no shipping
          </p>
        )}
        <p className="text-center text-[10px] mt-2 leading-snug text-black">{STORE_ADDRESS}</p>
        <p className="text-center text-[10px] mt-1 text-black">Messenger: {STORE_MESSENGER}</p>
      </div>
    </div>
  );
}

function Dash() {
  return <div className="my-3 border-t border-dashed border-black" aria-hidden />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 font-normal text-black">
      <span className="shrink-0 text-black">{label}</span>
      <span className="text-right min-w-0 break-words tabular-nums text-black">{value}</span>
    </div>
  );
}

/** Test receipt for hardware check. */
export function buildTestReceipt(): ReceiptData {
  return {
    saleId: "00000000-test-print-xp80",
    soldAt: new Date().toISOString(),
    subtotal: 275000,
    itemDiscount: 10000,
    discount: 5000,
    total: 260000,
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
        discount: 10000,
        lineTotal: 175000,
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

/** Embedded brand PNG — works in print popups without network. */
const CLOVER_LOGO_IMG = `<img src="${CLOVER_LOGO_DATA_URL}" width="42" height="42" alt="" style="display:block;margin:0 auto;object-fit:contain" />`;

/**
 * Build print HTML — store and website are separate layouts (not the same ticket).
 */
function buildReceiptPrintHtml(receipt: ReceiptData, paperMm: PaperWidthMm) {
  const channel = receipt.channel === "website" ? "website" : "store";
  return channel === "website"
    ? buildWebsitePrintHtml(receipt, paperMm)
    : buildStorePrintHtml(receipt, paperMm);
}

function sharedPrintCss(printW: number, body: number, small: number, brand: number) {
  /* Thermal printers are ~1-bit: gray CSS becomes nearly invisible. All ink = #000. */
  return `
    @page { size: auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000 !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${body}px;
      font-weight: 500;
      line-height: 1.45;
      width: ${printW}mm;
      max-width: ${printW}mm;
      padding: 3mm 2mm 5mm;
      color: #000 !important;
    }
    .center { text-align: center; }
    .logo { margin: 0 auto 4px; display: block; text-align: center; }
    .brand {
      font-size: ${brand}px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
    }
    .tag { font-size: ${small}px; font-style: italic; margin-top: 2px; font-weight: 500; }
    .phones { font-size: ${small}px; margin-top: 6px; font-weight: 500; }
    .dash { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    .eq { border: none; border-top: 2px solid #000; margin: 8px 0; }
    .block { font-size: ${small}px; }
    .row {
      display: flex; justify-content: space-between; gap: 8px;
      font-size: ${small}px; margin: 2px 0; font-weight: 500;
    }
    .row .k { color: #000 !important; font-weight: 500; }
    .row .v { text-align: right; word-break: break-word; color: #000 !important; font-weight: 600; }
    .item { margin: 0 0 8px; }
    .iname { font-weight: 700; word-break: break-word; }
    .imeta { font-size: ${small}px; margin-top: 1px; color: #000 !important; font-weight: 500; }
    .irow {
      display: flex; justify-content: space-between; gap: 8px;
      margin-top: 2px; font-size: ${small}px; font-weight: 500;
    }
    .total-row {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: 8px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #000;
    }
    .total-row .lbl { font-size: ${small}px; text-transform: uppercase; font-weight: 700; }
    .total-row .amt { font-size: ${Math.round(body * 1.25)}px; font-weight: 700; white-space: nowrap; }
    .thanks { text-align: center; font-size: ${small}px; margin-top: 6px; font-weight: 500; }
    .foot { text-align: center; font-size: ${small}px; margin-top: 6px; line-height: 1.4; font-weight: 500; }
    .hint {
      text-align: center; font-size: 9px; margin-top: 10px;
      border-top: 1px dashed #000; padding-top: 6px; color: #000 !important;
    }
    @media print {
      .hint { display: none !important; }
      html, body { width: ${printW}mm !important; max-width: ${printW}mm !important; }
      * { color: #000 !important; }
    }
  `;
}

function itemLinesHtml(items: ReceiptItem[]) {
  return items
    .map((line) => {
      const meta = [line.colorName, line.size ? `Sz ${line.size}` : null, line.productCode]
        .filter(Boolean)
        .join(" · ");
      const lineGross = line.unitPrice * line.quantity;
      const lineDisc = Math.max(0, Math.round(line.discount || 0));
      const lineNet = line.lineTotal ?? lineGross - lineDisc;
      return `
      <div class="item">
        <div class="iname">${escapeHtml(line.productName)}</div>
        ${meta ? `<div class="imeta">${escapeHtml(meta)}</div>` : ""}
        <div class="irow">
          <span>${line.quantity} x ${amt(line.unitPrice)}</span>
          <span>${amt(lineGross)}</span>
        </div>
        ${
          lineDisc > 0
            ? `<div class="irow"><span>Discount</span><span>-${amt(lineDisc)}</span></div>
               <div class="irow"><span>Line total</span><span>${amt(lineNet)}</span></div>`
            : ""
        }
      </div>`;
    })
    .join("");
}

/** Compact walk-in cash receipt (POS). */
function buildStorePrintHtml(receipt: ReceiptData, paperMm: PaperWidthMm) {
  const no = receiptNo(receipt.saleId);
  const when = new Date(receipt.soldAt).toLocaleString();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const printW = printableWidthMm(paperMm);
  const isNarrow = printW <= 52;
  const body = isNarrow ? 13 : 14;
  const small = isNarrow ? 12 : 13;
  const brand = isNarrow ? 15 : 17;
  const sub = receiptSubtotal(receipt);
  const itemDiscount = receiptItemDiscount(receipt);
  const orderDiscount = receiptOrderDiscount(receipt);
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const name = escapeHtml(receipt.customerName?.trim() || "");
  const note = noteClean(receipt.notes);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>STORE RECEIPT #${no}</title>
  <style>${sharedPrintCss(printW, body, small, brand)}
    .kind {
      display: inline-block; margin-top: 8px; padding: 3px 10px;
      border: 2px solid #000; font-size: ${small}px; font-weight: 700;
      letter-spacing: 0.12em; text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="logo">${CLOVER_LOGO_IMG}</div>
    <div class="brand">THE CLOVER</div>
    <div class="tag">Sportswear</div>
    <div class="kind">Store receipt</div>
    <div class="phones">${STORE_PHONES.map(escapeHtml).join(" · ")}</div>
  </div>
  <div class="dash"></div>
  <div class="block">
    <div class="row"><span class="k">Receipt #</span><span class="v">${no}</span></div>
    <div class="row"><span class="k">Date</span><span class="v">${escapeHtml(when)}</span></div>
    <div class="row"><span class="k">Payment</span><span class="v">${escapeHtml(pay)}</span></div>
    <div class="row"><span class="k">${unitsLabel(units)}</span><span class="v">${units}</span></div>
  </div>
  ${name ? `<div class="dash"></div><div class="block">Customer: ${name}</div>` : ""}
  <div class="dash"></div>
  ${itemLinesHtml(receipt.items)}
  <div class="dash"></div>
  <div class="block">
    <div class="row"><span class="k">Subtotal</span><span class="v">${amt(sub)}</span></div>
    ${
      itemDiscount > 0
        ? `<div class="row"><span class="k">Item discounts</span><span class="v">-${amt(itemDiscount)}</span></div>`
        : ""
    }
    ${
      orderDiscount > 0
        ? `<div class="row"><span class="k">Order discount</span><span class="v">-${amt(orderDiscount)}</span></div>`
        : ""
    }
    <div class="total-row">
      <span class="lbl">Total</span>
      <span class="amt">${formatMMK(receipt.total)}</span>
    </div>
  </div>
  ${note ? `<div class="dash"></div><div class="block">${escapeHtml(note)}</div>` : ""}
  <div class="dash"></div>
  <p class="thanks">Thank you for shopping with us</p>
  <p class="thanks">Paid in store</p>
  <p class="foot">${escapeHtml(STORE_ADDRESS)}<br/>Messenger: ${escapeHtml(STORE_MESSENGER)}</p>
  <p class="hint">STORE POS · ${paperMm}mm · scale 100% · margins None</p>
</body>
</html>`;
}

/** Online packing / order slip — clearly different from store receipt. */
function buildWebsitePrintHtml(receipt: ReceiptData, paperMm: PaperWidthMm) {
  const no = receiptNo(receipt.saleId);
  const when = new Date(receipt.soldAt).toLocaleString();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const printW = printableWidthMm(paperMm);
  const isNarrow = printW <= 52;
  const body = isNarrow ? 13 : 14;
  const small = isNarrow ? 12 : 13;
  const brand = isNarrow ? 15 : 17;
  const sub = itemsSubtotal(receipt.items);
  const shipping = receipt.shippingCents ?? 0;
  const tax = receipt.taxCents ?? 0;
  const other =
    shipping + tax > 0
      ? 0
      : Math.max(0, Math.round(receipt.total) - sub);
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const name = escapeHtml(receipt.customerName?.trim() || "");
  const phone = escapeHtml(receipt.customerPhone?.trim() || "");
  const address = escapeHtml(receipt.customerAddress?.trim() || "");
  const note = noteClean(receipt.notes);

  const packLines = receipt.items
    .map((line) => {
      const meta = [line.colorName, line.size ? `Sz ${line.size}` : null]
        .filter(Boolean)
        .join(" · ");
      return `<div class="pack-line">
        <span class="box">[ ]</span>
        <span class="pack-body">
          <strong>${line.quantity}x</strong> ${escapeHtml(line.productName)}
          ${meta ? `<div class="imeta">${escapeHtml(meta)}</div>` : ""}
        </span>
        <span class="pack-amt">${amt(line.lineTotal || line.unitPrice * line.quantity)}</span>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ONLINE ORDER #${no}</title>
  <style>${sharedPrintCss(printW, body, small, brand)}
    .banner {
      margin-top: 8px; padding: 6px 4px;
      border: 2px solid #000; font-weight: 700;
      letter-spacing: 0.14em; text-transform: uppercase;
      font-size: ${small}px;
    }
    .section {
      font-size: ${small - 1}px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      margin: 2px 0 6px;
    }
    .ship-box {
      border: 1px solid #000; padding: 6px 8px; margin: 4px 0 2px;
      font-size: ${small}px;
    }
    .pack-line {
      display: flex; gap: 6px; align-items: flex-start;
      margin: 0 0 8px; font-size: ${small}px;
    }
    .box { font-weight: 700; flex-shrink: 0; }
    .pack-body { flex: 1; min-width: 0; word-break: break-word; }
    .pack-amt { white-space: nowrap; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="center">
    <div class="logo">${CLOVER_LOGO_IMG}</div>
    <div class="brand">THE CLOVER</div>
    <div class="tag">Sportswear</div>
    <div class="banner">Online order · Packing slip</div>
    <div class="phones">${STORE_PHONES.map(escapeHtml).join(" · ")}</div>
  </div>

  <div class="eq"></div>
  <div class="block">
    <div class="row"><span class="k">Order #</span><span class="v">${no}</span></div>
    <div class="row"><span class="k">Placed</span><span class="v">${escapeHtml(when)}</span></div>
    <div class="row"><span class="k">Pay</span><span class="v">${escapeHtml(pay)}</span></div>
    <div class="row"><span class="k">Money</span><span class="v">${
      receipt.paymentReceived ? "RECEIVED" : "UNPAID — collect on delivery"
    }</span></div>
    <div class="row"><span class="k">Units</span><span class="v">${units}</span></div>
  </div>

  <div class="eq"></div>
  <div class="section">Ship to</div>
  <div class="ship-box">
    ${name || "—"}<br/>
    ${phone || ""}
    ${phone && address ? "<br/>" : ""}
    ${address || ""}
  </div>

  <div class="eq"></div>
  <div class="section">Pack these items</div>
  ${packLines}

  <div class="eq"></div>
  <div class="block">
    <div class="row"><span class="k">Subtotal</span><span class="v">${amt(sub)}</span></div>
    ${shipping > 0 ? `<div class="row"><span class="k">Shipping</span><span class="v">${amt(shipping)}</span></div>` : ""}
    ${tax > 0 ? `<div class="row"><span class="k">Tax</span><span class="v">${amt(tax)}</span></div>` : ""}
    ${other > 0 ? `<div class="row"><span class="k">Shipping / tax</span><span class="v">${amt(other)}</span></div>` : ""}
    <div class="total-row">
      <span class="lbl">Order total</span>
      <span class="amt">${formatMMK(receipt.total)}</span>
    </div>
  </div>

  ${note ? `<div class="dash"></div><div class="block">${escapeHtml(note)}</div>` : ""}

  <div class="eq"></div>
  <p class="thanks">Pack · label · ship</p>
  <p class="thanks">Thank you for your order</p>
  <p class="foot">${escapeHtml(STORE_ADDRESS)}<br/>Messenger: ${escapeHtml(STORE_MESSENGER)}</p>
  <p class="hint">WEBSITE ORDER · ${paperMm}mm · scale 100% · margins None</p>
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

/** Print via OS dialog. Optional forceChannel guarantees store vs website layout on every PC. */
export function printReceipt(
  receipt: ReceiptData,
  paperMm: PaperWidthMm = 80,
  forceChannel?: "store" | "website"
) {
  const data: ReceiptData = {
    ...receipt,
    channel: forceChannel || receipt.channel || "store",
  };
  const html = buildReceiptPrintHtml(data, paperMm);

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
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = CLOVER_LOGO_DATA_URL;
  });
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
  const sub = receiptSubtotal(receipt);
  const itemDiscount = receiptItemDiscount(receipt);
  const orderDiscount = receiptOrderDiscount(receipt);
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const shortId = receipt.saleId.slice(0, 8).toUpperCase();

  type Op =
    | { k: "gap"; h: number }
    | { k: "text"; t: string; s: number; w: string; a: CanvasTextAlign }
    | { k: "logo" }
    | { k: "dash" }
    | { k: "pair"; left: string; right: string; s: number };

  const ops: Op[] = [];
  /* Medium+ weight — thin 400 strokes anti-alias to gray and vanish on thermal. */
  const text = (t: string, s = fs, w = "600", a: CanvasTextAlign = "left") =>
    ops.push({ k: "text", t, s, w, a });
  const gap = (h: number) => ops.push({ k: "gap", h });
  const pair = (left: string, right: string, s = fsSm) => ops.push({ k: "pair", left, right, s });

  ops.push({ k: "logo" });
  gap(6);
  text("THE CLOVER", fsBrand, "700", "center");
  gap(2);
  text("Sportswear", fsSm, "600", "center");
  gap(4);
  text(receipt.channel === "website" ? "ONLINE ORDER" : "STORE SALE", fsSm, "700", "center");
  gap(6);
  text(STORE_PHONES.join(" · "), fsSm, "600", "center");
  gap(4);
  ops.push({ k: "dash" });
  gap(4);
  pair(receipt.channel === "website" ? "Order #" : "Receipt #", no);
  pair("Date", when);
  pair("Payment", pay);
  pair(unitsLabel(units), String(units));
  pair("Channel", receipt.channel === "website" ? "Website" : "Store POS");

  if (receipt.customerName?.trim() || receipt.customerPhone?.trim() || receipt.customerAddress?.trim()) {
    gap(4);
    ops.push({ k: "dash" });
    gap(4);
    if (receipt.customerName?.trim()) text(`Name: ${receipt.customerName.trim()}`, fsSm, "600");
    if (receipt.customerPhone?.trim()) text(`Phone: ${receipt.customerPhone.trim()}`, fsSm, "600");
    if (receipt.customerAddress?.trim()) text(`Addr: ${receipt.customerAddress.trim()}`, fsSm, "600");
  }

  gap(4);
  ops.push({ k: "dash" });
  gap(4);
  pair(unitsLabel(units).toUpperCase(), "AMOUNT", fsSm);

  for (const item of receipt.items) {
    gap(6);
    text(item.productName, fs, "700");
    const meta = [item.colorName, item.size ? `Sz ${item.size}` : null, item.productCode]
      .filter(Boolean)
      .join(" · ");
    if (meta) text(meta, fsSm, "600");
    const lineGross = item.unitPrice * item.quantity;
    const lineDisc = Math.max(0, Math.round(item.discount || 0));
    pair(`${item.quantity} x ${amt(item.unitPrice)}`, amt(lineGross), fsSm);
    if (lineDisc > 0) {
      pair("Discount", `-${amt(lineDisc)}`, fsSm);
      pair("Line total", amt(lineGross - lineDisc), fsSm);
    }
  }

  gap(4);
  ops.push({ k: "dash" });
  gap(4);
  pair("Subtotal", amt(sub));
  if (itemDiscount > 0) pair("Item discounts", `-${amt(itemDiscount)}`);
  if (orderDiscount > 0) pair("Order discount", `-${amt(orderDiscount)}`);
  gap(4);
  text(`TOTAL  ${formatMMK(receipt.total)}`, fsTotal, "700", "center");

  if (note) {
    gap(6);
    ops.push({ k: "dash" });
    gap(4);
    text(note, fsSm, "600");
  }

  gap(6);
  ops.push({ k: "dash" });
  gap(6);
  text("Thank you for shopping", fsSm, "600", "center");
  gap(6);
  text(STORE_ADDRESS, fsSm, "600", "center");
  gap(2);
  text(`Messenger: ${STORE_MESSENGER}`, fsSm, "600", "center");

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
  ctx.imageSmoothingEnabled = false;

  let y = pad;
  for (const op of ops) {
    if (op.k === "gap") {
      y += op.h;
      continue;
    }
    if (op.k === "logo") {
      const lx = (W - logoSize) / 2;
      if (logo) ctx.drawImage(logo, lx, y, logoSize, logoSize);
      y += logoSize + 4;
      continue;
    }
    if (op.k === "dash") {
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(pad, y + 4);
      ctx.lineTo(W - pad, y + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      y += 10;
      continue;
    }
    if (op.k === "pair") {
      ctx.font = `600 ${op.s}px Arial, Helvetica, sans-serif`;
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

  /* Flatten anti-aliased gray to pure black/white for thermal heads. */
  const pixels = ctx.getImageData(0, 0, W, canvas.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = lum < 200 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);

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
