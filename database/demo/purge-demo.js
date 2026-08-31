/**
 * Remove all tagged demo analytics rows from the database.
 * Does not delete catalog products or real (non-demo) sales.
 */

export const DEMO_TAG = "[demo-analytics]";

/**
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 */
export async function purgeDemoData(query) {
  await query(
    `DELETE FROM iconic_sales_report_items WHERE report_id IN (
       SELECT id FROM iconic_sales_reports WHERE notes LIKE $1
     )`,
    [`%${DEMO_TAG}%`]
  );
  await query(`DELETE FROM iconic_sales_reports WHERE notes LIKE $1`, [`%${DEMO_TAG}%`]);

  await query(
    `DELETE FROM iconic_transfer_items WHERE transfer_id IN (
       SELECT id FROM iconic_transfers WHERE notes LIKE $1
     )`,
    [`%${DEMO_TAG}%`]
  );
  await query(`DELETE FROM iconic_transfers WHERE notes LIKE $1`, [`%${DEMO_TAG}%`]);

  await query(
    `DELETE FROM store_sale_items WHERE sale_id IN (
       SELECT id FROM store_sales WHERE notes LIKE $1
     )`,
    [`%${DEMO_TAG}%`]
  );
  await query(`DELETE FROM store_sales WHERE notes LIKE $1`, [`%${DEMO_TAG}%`]);

  await query(
    `DELETE FROM order_items WHERE order_id IN (
       SELECT id FROM orders WHERE payment_ref LIKE 'demo_analytics_%'
     )`
  );
  await query(`DELETE FROM orders WHERE payment_ref LIKE 'demo_analytics_%'`);

  console.log("[demo] Purged demo analytics rows (website / store / ICONIC).");
}
