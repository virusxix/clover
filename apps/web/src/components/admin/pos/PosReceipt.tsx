"use client";

/**
 * THE CLOVER store receipt — on-screen + PeriPage A40–friendly print.
 * A40 paper widths: 56mm / 77mm / 107mm / 210mm (A4).
 */

import { formatMMK } from "@/lib/currency";

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
};

/** PeriPage A40 supported widths (mm) */
export type PaperWidthMm = 56 | 77 | 107 | 210;

export const PAPER_OPTIONS: { mm: PaperWidthMm; label: string }[] = [
  { mm: 56, label: "56mm (2\")" },
  { mm: 77, label: "77mm (3\")" },
  { mm: 107, label: "107mm (4\")" },
  { mm: 210, label: "210mm (A4)" },
];

const PAY_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  other: "Other",
};

const PAPER_STORAGE_KEY = "clover-pos-paper-mm";

/** Store location shown on screen, print, and PNG (must stay in sync). */
const STORE_PLACE = "Mandalay · Myanmar";

/** Inline clover mark — crisp on screen + thermal print */
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

function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-neutral-400 ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-400 to-transparent" />
      <span className="text-[8px] tracking-[0.35em]">◆</span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-400 to-transparent" />
    </div>
  );
}

export function loadPaperWidth(): PaperWidthMm {
  if (typeof window === "undefined") return 56;
  const n = Number(localStorage.getItem(PAPER_STORAGE_KEY));
  if (n === 56 || n === 77 || n === 107 || n === 210) return n;
  return 56;
}

export function savePaperWidth(mm: PaperWidthMm) {
  localStorage.setItem(PAPER_STORAGE_KEY, String(mm));
}

type Props = {
  receipt: ReceiptData;
  className?: string;
};

export function PosReceipt({ receipt, className = "" }: Props) {
  const when = new Date(receipt.soldAt);
  const shortId = receipt.saleId.slice(0, 8).toUpperCase();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div
      className={`pos-receipt relative overflow-hidden rounded-sm border border-neutral-200 bg-[#fafaf8] text-neutral-900 shadow-[0_1px_0_rgba(0,0,0,0.04)] ${className}`}
      data-receipt
    >
      {/* Soft corner accents */}
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent" />
      <div className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-transparent via-neutral-300 to-transparent" />
      <div className="pointer-events-none absolute inset-y-3 right-0 w-px bg-gradient-to-b from-transparent via-neutral-300 to-transparent" />

      <div className="pos-receipt__inner relative px-4 py-5 sm:px-5">
        <header className="text-center mb-1">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-900 shadow-sm">
            <CloverMark size={34} />
          </div>
          <p className="text-[11px] font-semibold tracking-[0.42em] uppercase text-neutral-900">
            THE CLOVER
          </p>
          <p className="mt-1.5 text-[9px] font-medium tracking-[0.28em] uppercase text-neutral-500">
            Premium Sportswear
          </p>
          <Ornament className="mt-3 mb-1" />
          <h1 className="mt-2 text-[13px] font-medium tracking-[0.2em] uppercase text-neutral-700">
            Store Receipt
          </h1>
          <p className="mt-1 text-[10px] tracking-wide text-neutral-500">{STORE_PLACE}</p>
        </header>

        <div className="mt-4 flex justify-between gap-3 border-y border-double border-neutral-800 py-2.5 text-[11px] text-neutral-600">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.18em] text-neutral-400">Date</p>
            <p className="mt-0.5 truncate">{when.toLocaleString()}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] uppercase tracking-[0.18em] text-neutral-400">No.</p>
            <p className="mt-0.5 font-mono tracking-wider">#{shortId}</p>
          </div>
        </div>

        <table className="w-full text-sm mt-3 mb-1">
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.2em] text-neutral-400">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((line, idx) => (
              <tr
                key={`${line.productName}-${line.size}-${idx}`}
                className="align-top border-t border-neutral-200/80"
              >
                <td className="py-2.5 pr-2">
                  <p className="font-semibold leading-snug tracking-tight">{line.productName}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {[line.productCode, line.colorName, `Sz ${line.size}`, `×${line.quantity}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-[11px] text-neutral-400">@ {formatMMK(line.unitPrice)}</p>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap font-medium tabular-nums">
                  {formatMMK(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 border-t-2 border-neutral-900 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-[12px] text-neutral-500">
            <span className="tracking-wide">Items</span>
            <span className="tabular-nums">{units}</span>
          </div>
          <div className="flex justify-between text-[12px] text-neutral-500">
            <span className="tracking-wide">Payment</span>
            <span>{pay}</span>
          </div>
          <div className="mt-1 flex items-end justify-between border-t border-neutral-200 pt-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">Total</span>
            <span className="text-xl font-black tracking-tight tabular-nums">
              {formatMMK(receipt.total)}
            </span>
          </div>
        </div>

        {receipt.notes && !/^pay:/.test(receipt.notes) && (
          <p className="mt-3 text-[11px] text-neutral-500">
            Note: {receipt.notes.replace(/\s*·\s*pay:[a-z_]+/i, "")}
          </p>
        )}

        <Ornament className="mt-5" />
        <p className="mt-3 text-center text-[10px] tracking-[0.12em] text-neutral-500">
          Thank you for shopping with us
        </p>
        <p className="mt-1 text-center text-[9px] font-semibold tracking-[0.35em] uppercase text-neutral-800">
          THE CLOVER
        </p>
        <p className="mt-3 text-center text-[9px] tracking-wide text-neutral-400">
          theclover.com
        </p>
      </div>
    </div>
  );
}

/** Demo receipt for PeriPage A40 hardware test (no sale required). */
export function buildTestReceipt(): ReceiptData {
  return {
    saleId: "00000000-test-print-a40",
    soldAt: new Date().toISOString(),
    total: 275000,
    paymentMethod: "cash",
    notes: "TEST PRINT · PeriPage A40",
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="42" height="42" fill="none" aria-hidden="true">
  <path stroke="#111" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    d="M24 8 C30 8 34 12 34 18 C34 24 30 28 24 28 C18 28 14 24 14 18 C14 12 18 8 24 8 Z
       M24 20 C30 20 34 24 34 30 C34 36 30 40 24 40 C18 40 14 36 14 30 C14 24 18 20 24 20 Z" />
  <path stroke="#111" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    d="M40 24 C40 30 36 34 30 34 C24 34 20 30 20 24 C20 18 24 14 30 14 C36 14 40 18 40 24 Z
       M28 24 C28 30 24 34 18 34 C12 34 8 30 8 24 C8 18 12 14 18 14 C24 14 28 18 28 24 Z" />
</svg>`;

/**
 * Open a print window sized for PeriPage A40.
 * Tip: set paper clips on the A40 to match `paperMm`, then choose that printer in the dialog.
 */
export function printReceipt(receipt: ReceiptData, paperMm: PaperWidthMm = 56) {
  const when = new Date(receipt.soldAt).toLocaleString();
  const shortId = receipt.saleId.slice(0, 8).toUpperCase();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const contentW = Math.max(48, paperMm - 8);
  const isNarrow = paperMm <= 77;
  const bodyFont = isNarrow ? 11 : 12;
  const titleTrack = isNarrow ? "0.28em" : "0.36em";

  const rows = receipt.items
    .map(
      (line) => `
      <tr>
        <td style="padding:8px 4px 8px 0;vertical-align:top;border-top:1px solid #e5e5e5">
          <div style="font-weight:700;letter-spacing:-0.01em">${escapeHtml(line.productName)}</div>
          <div style="font-size:10px;color:#555;margin-top:2px">
            ${escapeHtml(
              [line.productCode, line.colorName, `Sz ${line.size}`, `x${line.quantity}`]
                .filter(Boolean)
                .join(" · ")
            )}
          </div>
          <div style="font-size:10px;color:#777;margin-top:1px">@ ${formatMMK(line.unitPrice)}</div>
        </td>
        <td style="padding:8px 0;text-align:right;white-space:nowrap;font-weight:600;border-top:1px solid #e5e5e5;font-variant-numeric:tabular-nums">
          ${formatMMK(line.lineTotal)}
        </td>
      </tr>`
    )
    .join("");

  const noteClean = (receipt.notes || "").replace(/\s*·\s*pay:[a-z_]+/i, "").trim();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>THE CLOVER Receipt #${shortId}</title>
  <style>
    @page {
      size: ${paperMm}mm auto;
      margin: 3mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "Helvetica Neue", Helvetica, "DejaVu Sans", Arial, sans-serif;
      font-size: ${bodyFont}px;
      line-height: 1.4;
      width: ${contentW}mm;
      max-width: 100%;
      padding: 3mm 2mm;
      margin: 0 auto;
    }
    .logo-wrap {
      width: 48px; height: 48px; margin: 0 auto 8px;
      border: 1px solid #222; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .logo-wrap svg { display: block; }
    .brand {
      font-size: ${isNarrow ? 10 : 11}px;
      letter-spacing: ${titleTrack};
      text-transform: uppercase;
      font-weight: 700;
      margin: 0;
    }
    .tag {
      font-size: 8px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: #666;
      margin: 6px 0 0;
    }
    .ornament {
      display: flex; align-items: center; gap: 8px;
      margin: 10px 0 8px; color: #999; font-size: 7px; letter-spacing: 0.2em;
    }
    .ornament::before, .ornament::after {
      content: ""; flex: 1; height: 1px; background: #ccc;
    }
    .receipt-label {
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #444;
      margin: 0;
      font-weight: 500;
    }
    .place { font-size: 9px; color: #777; margin: 4px 0 0; }
    .meta {
      display: flex; justify-content: space-between; gap: 8px;
      font-size: 10px;
      border-top: 3px double #111;
      border-bottom: 3px double #111;
      padding: 8px 0;
      margin: 12px 0 4px;
    }
    .meta .lbl { font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase; color: #888; }
    .meta .val { margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    thead th {
      font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase;
      color: #888; font-weight: 500; padding: 6px 0; text-align: left;
    }
    thead th:last-child { text-align: right; }
    .total { border-top: 2px solid #111; padding-top: 10px; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; color: #555; }
    .grand {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;
    }
    .grand .lbl { font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 700; }
    .grand .amt { font-size: ${isNarrow ? 15 : 17}px; font-weight: 900; letter-spacing: -0.02em; }
    .thanks { text-align: center; font-size: 10px; margin-top: 16px; color: #555; letter-spacing: 0.06em; }
    .thanks-brand {
      text-align: center; font-size: 9px; letter-spacing: 0.32em;
      text-transform: uppercase; font-weight: 700; margin: 4px 0 0;
    }
    .web { text-align: center; font-size: 8px; color: #999; margin-top: 10px; letter-spacing: 0.08em; }
    .hint { text-align: center; font-size: 8px; color: #aaa; margin-top: 10px; }
    @media print {
      .hint { display: none; }
    }
  </style>
</head>
<body>
  <div style="text-align:center">
    <div class="logo-wrap">${CLOVER_SVG_MARK}</div>
    <p class="brand">THE CLOVER</p>
    <p class="tag">Premium Sportswear</p>
    <div class="ornament">◆</div>
    <p class="receipt-label">Store Receipt</p>
    <p class="place">${STORE_PLACE}</p>
  </div>
  <div class="meta">
    <div>
      <div class="lbl">Date</div>
      <div class="val">${escapeHtml(when)}</div>
    </div>
    <div style="text-align:right">
      <div class="lbl">No.</div>
      <div class="val" style="font-family:ui-monospace,monospace;letter-spacing:0.06em">#${shortId}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">
    <div class="row"><span>Items</span><span>${units}</span></div>
    <div class="row"><span>Payment</span><span>${escapeHtml(pay)}</span></div>
    <div class="grand">
      <span class="lbl">Total</span>
      <span class="amt">${formatMMK(receipt.total)}</span>
    </div>
  </div>
  ${noteClean ? `<p style="font-size:10px;margin-top:12px;color:#555">Note: ${escapeHtml(noteClean)}</p>` : ""}
  <div class="ornament">◆</div>
  <p class="thanks">Thank you for shopping with us</p>
  <p class="thanks-brand">THE CLOVER</p>
  <p class="web">theclover.com</p>
  <p class="hint">Printer paper: ${paperMm}mm · PeriPage A40</p>
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=760");
  if (!win) {
    alert("Allow pop-ups to print the receipt");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function loadLogoImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${window.location.origin}/assets/logo-icon.png`;
  });
}

/** Draw a simple clover from paths when the PNG fails to load. */
function drawCloverFallback(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = Math.max(1.2, r * 0.06);
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

function drawOrnamentLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  widthPx: number,
  pad: number,
  size: number
) {
  const mid = widthPx / 2;
  ctx.save();
  ctx.strokeStyle = "#bbb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y + size / 2);
  ctx.lineTo(mid - size * 1.2, y + size / 2);
  ctx.moveTo(mid + size * 1.2, y + size / 2);
  ctx.lineTo(widthPx - pad, y + size / 2);
  ctx.stroke();
  ctx.fillStyle = "#888";
  ctx.font = `500 ${size}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("◆", mid, y + size / 2);
  ctx.restore();
}

/**
 * Download receipt as PNG for PeriPage mobile app (phone path).
 * A40 prints images reliably from the PeriPage app.
 */
export async function downloadReceiptPng(
  receipt: ReceiptData,
  paperMm: PaperWidthMm = 56
): Promise<File | null> {
  const dpi = 203;
  const widthPx = Math.round((paperMm / 25.4) * dpi);
  const pad = Math.round(widthPx * 0.07);
  const lineH = Math.round(widthPx * 0.042);
  const small = Math.round(widthPx * 0.03);
  const brand = Math.round(widthPx * 0.038);
  const totalSize = Math.round(widthPx * 0.052);
  const logoSize = Math.round(widthPx * 0.18);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;

  type DrawOp =
    | { kind: "gap"; h: number }
    | { kind: "text"; text: string; size: number; weight: string; align: CanvasTextAlign; color?: string }
    | { kind: "logo" }
    | { kind: "ornament" }
    | { kind: "rule"; style: "single" | "double" | "thick" };

  const ops: DrawOp[] = [];
  const text = (
    t: string,
    size = lineH,
    weight = "400",
    align: CanvasTextAlign = "left",
    color = "#111"
  ) => ops.push({ kind: "text", text: t, size, weight, align, color });
  const gap = (h: number) => ops.push({ kind: "gap", h });

  const when = new Date(receipt.soldAt).toLocaleString();
  const shortId = receipt.saleId.slice(0, 8).toUpperCase();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const noteClean = (receipt.notes || "").replace(/\s*·\s*pay:[a-z_]+/i, "").trim();

  ops.push({ kind: "logo" });
  gap(Math.round(small * 0.6));
  text("THE CLOVER", brand, "700", "center");
  gap(Math.round(small * 0.35));
  text("PREMIUM SPORTSWEAR", small, "500", "center", "#666");
  gap(Math.round(small * 0.5));
  ops.push({ kind: "ornament" });
  gap(Math.round(small * 0.4));
  text("STORE RECEIPT", small, "500", "center", "#444");
  gap(Math.round(small * 0.25));
  text(STORE_PLACE, small, "400", "center", "#777");
  gap(Math.round(small * 0.7));
  ops.push({ kind: "rule", style: "double" });
  gap(Math.round(small * 0.45));
  text(when, small, "400", "center", "#555");
  text(`#${shortId}`, small, "500", "center");
  gap(Math.round(small * 0.35));
  ops.push({ kind: "rule", style: "double" });
  gap(Math.round(small * 0.55));

  for (const item of receipt.items) {
    text(item.productName, lineH, "700");
    text(
      [item.productCode, item.colorName, `Sz ${item.size}`, `x${item.quantity}`]
        .filter(Boolean)
        .join(" · "),
      small,
      "400",
      "left",
      "#555"
    );
    text(`@ ${formatMMK(item.unitPrice)}`, small, "400", "left", "#777");
    text(formatMMK(item.lineTotal), lineH, "700", "right");
    gap(Math.round(small * 0.55));
  }

  ops.push({ kind: "rule", style: "thick" });
  gap(Math.round(small * 0.45));
  text(`Items          ${units}`, small, "400", "left", "#555");
  text(`Payment     ${pay}`, small, "400", "left", "#555");
  gap(Math.round(small * 0.35));
  ops.push({ kind: "rule", style: "single" });
  gap(Math.round(small * 0.4));
  text(`TOTAL  ${formatMMK(receipt.total)}`, totalSize, "900", "center");
  if (noteClean) {
    gap(Math.round(small * 0.5));
    text(`Note: ${noteClean}`, small, "400", "left", "#555");
  }
  gap(Math.round(small * 0.9));
  ops.push({ kind: "ornament" });
  gap(Math.round(small * 0.5));
  text("Thank you for shopping with us", small, "400", "center", "#555");
  gap(Math.round(small * 0.3));
  text("THE CLOVER", small, "700", "center");
  gap(Math.round(small * 0.45));
  text("theclover.com", Math.round(small * 0.9), "400", "center", "#999");

  const logo = await loadLogoImage();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    alert("Could not create receipt image");
    return null;
  }

  let height = pad * 2;
  for (const op of ops) {
    if (op.kind === "gap") height += op.h;
    else if (op.kind === "text") height += op.size * 1.4;
    else if (op.kind === "logo") height += logoSize + Math.round(small * 0.4);
    else if (op.kind === "ornament") height += small;
    else if (op.kind === "rule") height += op.style === "double" ? 6 : 4;
  }
  canvas.height = Math.ceil(height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";

  let y = pad;
  for (const op of ops) {
    if (op.kind === "gap") {
      y += op.h;
      continue;
    }
    if (op.kind === "logo") {
      const lx = (widthPx - logoSize) / 2;
      // Circle frame
      ctx.strokeStyle = "#222";
      ctx.lineWidth = Math.max(1, widthPx * 0.004);
      ctx.beginPath();
      ctx.arc(widthPx / 2, y + logoSize / 2, logoSize / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
      if (logo) {
        ctx.drawImage(logo, lx, y, logoSize, logoSize);
      } else {
        drawCloverFallback(ctx, widthPx / 2, y + logoSize / 2, logoSize * 0.42);
      }
      y += logoSize + Math.round(small * 0.4);
      continue;
    }
    if (op.kind === "ornament") {
      drawOrnamentLine(ctx, y, widthPx, pad, small);
      y += small;
      continue;
    }
    if (op.kind === "rule") {
      ctx.strokeStyle = "#111";
      if (op.style === "thick") {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad, y + 1);
        ctx.lineTo(widthPx - pad, y + 1);
        ctx.stroke();
        y += 4;
      } else if (op.style === "double") {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(widthPx - pad, y);
        ctx.moveTo(pad, y + 3);
        ctx.lineTo(widthPx - pad, y + 3);
        ctx.stroke();
        y += 6;
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#ccc";
        ctx.beginPath();
        ctx.moveTo(pad, y + 1);
        ctx.lineTo(widthPx - pad, y + 1);
        ctx.stroke();
        y += 4;
      }
      continue;
    }

    ctx.fillStyle = op.color || "#111";
    ctx.font = `${op.weight} ${op.size}px Helvetica Neue, DejaVu Sans, Arial, sans-serif`;
    ctx.textAlign = op.align;
    const x =
      op.align === "center" ? widthPx / 2 : op.align === "right" ? widthPx - pad : pad;
    ctx.fillText(op.text, x, y, widthPx - pad * 2);
    y += op.size * 1.4;
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
        text: `Receipt #${shortId}`,
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
