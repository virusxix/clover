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
    <div className={`pos-receipt ${className}`} data-receipt>
      <div className="pos-receipt__inner">
        <header className="text-center mb-4">
          <p className="text-[10px] font-bold tracking-[0.35em] uppercase text-neutral-500">
            THE CLOVER
          </p>
          <h1 className="text-xl font-black tracking-tight mt-1">Store Receipt</h1>
          <p className="text-xs text-neutral-500 mt-1">Premium sportswear · Yangon</p>
        </header>

        <div className="flex justify-between text-xs text-neutral-600 border-y border-dashed border-neutral-300 py-2 mb-3">
          <span>{when.toLocaleString()}</span>
          <span className="font-mono">#{shortId}</span>
        </div>

        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="pb-1">Item</th>
              <th className="pb-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((line, idx) => (
              <tr key={`${line.productName}-${line.size}-${idx}`} className="align-top">
                <td className="py-1.5 pr-2">
                  <p className="font-semibold leading-snug">{line.productName}</p>
                  <p className="text-[11px] text-neutral-500">
                    {[line.productCode, line.colorName, `Sz ${line.size}`, `×${line.quantity}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    @ {formatMMK(line.unitPrice)}
                  </p>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap font-medium">
                  {formatMMK(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-neutral-900 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Items</span>
            <span>{units}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Payment</span>
            <span>{pay}</span>
          </div>
          <div className="flex justify-between text-lg font-black tracking-tight pt-1">
            <span>Total</span>
            <span>{formatMMK(receipt.total)}</span>
          </div>
        </div>

        {receipt.notes && !/^pay:/.test(receipt.notes) && (
          <p className="text-[11px] text-neutral-500 mt-3">
            Note: {receipt.notes.replace(/\s*·\s*pay:[a-z_]+/i, "")}
          </p>
        )}

        <p className="text-center text-[10px] text-neutral-400 mt-6 tracking-wide">
          Thank you for shopping at THE CLOVER
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
  const bodyFont = isNarrow ? 12 : 13;
  const titleFont = isNarrow ? 16 : 18;

  const rows = receipt.items
    .map(
      (line) => `
      <tr>
        <td style="padding:5px 4px 5px 0;vertical-align:top">
          <div style="font-weight:700">${escapeHtml(line.productName)}</div>
          <div style="font-size:11px;color:#444">
            ${escapeHtml(
              [line.productCode, line.colorName, `Sz ${line.size}`, `x${line.quantity}`]
                .filter(Boolean)
                .join(" · ")
            )}
          </div>
          <div style="font-size:11px;color:#444">@ ${formatMMK(line.unitPrice)}</div>
        </td>
        <td style="padding:5px 0;text-align:right;white-space:nowrap;font-weight:600">
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
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "DejaVu Sans", "Noto Sans", Arial, Helvetica, sans-serif;
      font-size: ${bodyFont}px;
      line-height: 1.35;
      width: ${contentW}mm;
      max-width: 100%;
      padding: 2mm;
      margin: 0 auto;
    }
    h1 { font-size: ${titleFont}px; margin: 4px 0; letter-spacing: -0.02em; }
    .brand { font-size: 9px; letter-spacing: 0.28em; text-transform: uppercase; font-weight: 700; }
    .sub { font-size: 11px; color: #333; }
    .meta {
      display: flex; justify-content: space-between; gap: 6px;
      font-size: 11px; border-top: 1px dashed #000; border-bottom: 1px dashed #000;
      padding: 6px 0; margin: 8px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    .total { border-top: 2px solid #000; padding-top: 8px; margin-top: 6px; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px; }
    .grand { display: flex; justify-content: space-between; font-size: ${isNarrow ? 15 : 17}px; font-weight: 900; margin-top: 4px; }
    .thanks { text-align: center; font-size: 10px; margin-top: 14px; }
    .hint { text-align: center; font-size: 9px; color: #666; margin-top: 8px; }
    @media print {
      .hint { display: none; }
    }
  </style>
</head>
<body>
  <div style="text-align:center">
    <div class="brand">THE CLOVER</div>
    <h1>Store Receipt</h1>
    <div class="sub">Premium sportswear · Yangon</div>
  </div>
  <div class="meta">
    <span>${escapeHtml(when)}</span>
    <span style="font-family:ui-monospace,monospace">#${shortId}</span>
  </div>
  <table><tbody>${rows}</tbody></table>
  <div class="total">
    <div class="row"><span>Items</span><span>${units}</span></div>
    <div class="row"><span>Payment</span><span>${escapeHtml(pay)}</span></div>
    <div class="grand"><span>Total</span><span>${formatMMK(receipt.total)}</span></div>
  </div>
  ${noteClean ? `<p style="font-size:11px;margin-top:10px">Note: ${escapeHtml(noteClean)}</p>` : ""}
  <p class="thanks">Thank you for shopping at THE CLOVER</p>
  <p class="hint">Printer paper: ${paperMm}mm · PeriPage A40</p>
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 200);
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
  const pad = Math.round(widthPx * 0.06);
  const lineH = Math.round(widthPx * 0.045);
  const small = Math.round(widthPx * 0.032);
  const title = Math.round(widthPx * 0.055);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  const lines: { text: string; size: number; weight: string; align?: CanvasTextAlign }[] = [];

  const push = (
    text: string,
    size = lineH,
    weight = "400",
    align: CanvasTextAlign = "left"
  ) => lines.push({ text, size, weight, align });

  const when = new Date(receipt.soldAt).toLocaleString();
  const shortId = receipt.saleId.slice(0, 8).toUpperCase();
  const pay = PAY_LABELS[receipt.paymentMethod || "cash"] || "Cash";
  const units = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const noteClean = (receipt.notes || "").replace(/\s*·\s*pay:[a-z_]+/i, "").trim();

  push("THE CLOVER", small, "700", "center");
  push("Store Receipt", title, "900", "center");
  push("Premium sportswear · Yangon", small, "400", "center");
  push(" ", small);
  push(`${when}`, small, "400", "center");
  push(`#${shortId}`, small, "400", "center");
  push("-".repeat(28), small, "400", "center");

  for (const item of receipt.items) {
    push(item.productName, lineH, "700");
    push(
      [item.productCode, item.colorName, `Sz ${item.size}`, `x${item.quantity}`]
        .filter(Boolean)
        .join(" · "),
      small
    );
    push(`@ ${formatMMK(item.unitPrice)}`, small);
    push(formatMMK(item.lineTotal), lineH, "700", "right");
    push(" ", Math.round(small * 0.5));
  }

  push("-".repeat(28), small, "400", "center");
  push(`Items: ${units}`, small);
  push(`Payment: ${pay}`, small);
  push(`TOTAL  ${formatMMK(receipt.total)}`, title, "900");
  if (noteClean) push(`Note: ${noteClean}`, small);
  push(" ", lineH);
  push("Thank you for shopping", small, "400", "center");
  push("at THE CLOVER", small, "400", "center");

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    alert("Could not create receipt image");
    return null;
  }
  let height = pad * 2;
  for (const L of lines) height += L.size * 1.35;
  canvas.height = Math.ceil(height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  let y = pad;
  for (const L of lines) {
    ctx.font = `${L.weight} ${L.size}px DejaVu Sans, Noto Sans, Arial, sans-serif`;
    ctx.textAlign = L.align || "left";
    const x =
      L.align === "center" ? widthPx / 2 : L.align === "right" ? widthPx - pad : pad;
    ctx.fillText(L.text, x, y, widthPx - pad * 2);
    y += L.size * 1.35;
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

  // Prefer native share on phones (AirDrop / Files / PeriPage if listed)
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "THE CLOVER receipt",
        text: `Receipt #${shortId}`,
      });
      return file;
    } catch (err) {
      // User cancelled share — fall through to download
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
