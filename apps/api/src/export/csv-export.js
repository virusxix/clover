/**
 * Excel-friendly export
 * ---------------------
 * One job: turn rows into a CSV that opens cleanly in Excel (UTF-8 BOM).
 */

/** Escape one CSV cell. */
function cell(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Build CSV text from headers + row objects.
 * @param {string[]} headers
 * @param {Record<string, unknown>[]} rows
 * @param {(row) => unknown[]} mapRow
 */
export function toCsv(headers, rows, mapRow) {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) {
    lines.push(mapRow(row).map(cell).join(","));
  }
  // BOM so Excel detects UTF-8
  return `\uFEFF${lines.join("\r\n")}`;
}

export function csvResponse(res, filename, csvText) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvText);
}
