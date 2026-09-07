/**
 * Store / website customer CRM
 * ----------------------------
 * Loyalty segments for walk-ins and linked website accounts.
 */

const SEGMENTS = new Set(["new", "regular", "loyal", "vip"]);

export function normalizePhone(phone) {
  if (phone == null || phone === "") return null;
  const cleaned = String(phone).replace(/[^\d+]/g, "").trim();
  return cleaned || null;
}

/**
 * @param {{ query: Function }} db
 * @param {{ q?: string, segment?: string, limit?: number }} [opts]
 */
export async function listCustomers(db, { q = "", segment = "", limit = 200 } = {}) {
  const needle = String(q || "").trim();
  const params = [];
  const where = [];

  if (segment && SEGMENTS.has(segment)) {
    params.push(segment);
    where.push(`c.segment = $${params.length}`);
  }
  if (needle) {
    params.push(`%${needle.toLowerCase()}%`);
    where.push(
      `(lower(c.name) LIKE $${params.length}
        OR lower(coalesce(c.email,'')) LIKE $${params.length}
        OR coalesce(c.phone,'') LIKE $${params.length})`
    );
  }

  params.push(Math.min(500, Math.max(1, Number(limit) || 200)));
  const sql = `
    SELECT c.*,
           (
             SELECT COUNT(*)::int FROM orders o
             WHERE o.customer_id = c.id
                OR (c.user_id IS NOT NULL AND o.user_id = c.user_id)
           ) AS order_count,
           (
             SELECT COUNT(*)::int FROM store_sales s WHERE s.customer_id = c.id
           ) AS store_sale_count
    FROM customers c
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY c.updated_at DESC, c.created_at DESC
    LIMIT $${params.length}
  `;
  const { rows } = await db.query(sql, params);
  return rows;
}

/**
 * @param {{ query: Function }} db
 * @param {{ name, phone?, email?, segment?, notes?, userId? }} data
 */
export async function createCustomer(db, data) {
  const name = String(data.name || "").trim();
  if (!name) {
    const err = new Error("Customer name is required");
    err.status = 400;
    throw err;
  }
  const segment = SEGMENTS.has(data.segment) ? data.segment : "new";
  const phone = normalizePhone(data.phone);
  const email = data.email ? String(data.email).trim().toLowerCase() : null;
  const notes = String(data.notes || "").trim();

  const { rows } = await db.query(
    `INSERT INTO customers (name, phone, email, segment, notes, user_id)
     VALUES ($1, $2, $3, $4::customer_segment, $5, $6)
     RETURNING *`,
    [name, phone, email, segment, notes, data.userId || null]
  );
  return rows[0];
}

/**
 * @param {{ query: Function }} db
 * @param {string} id
 * @param {{ name?, phone?, email?, segment?, notes? }} data
 */
export async function updateCustomer(db, id, data) {
  const { rows: existing } = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
  if (!existing.length) {
    const err = new Error("Customer not found");
    err.status = 404;
    throw err;
  }
  const cur = existing[0];
  const name = data.name != null ? String(data.name).trim() : cur.name;
  if (!name) {
    const err = new Error("Customer name is required");
    err.status = 400;
    throw err;
  }
  const segment =
    data.segment != null
      ? SEGMENTS.has(data.segment)
        ? data.segment
        : cur.segment
      : cur.segment;
  const phone = data.phone !== undefined ? normalizePhone(data.phone) : cur.phone;
  const email =
    data.email !== undefined
      ? data.email
        ? String(data.email).trim().toLowerCase()
        : null
      : cur.email;
  const notes = data.notes !== undefined ? String(data.notes || "").trim() : cur.notes;

  const { rows } = await db.query(
    `UPDATE customers
     SET name = $2, phone = $3, email = $4, segment = $5::customer_segment,
         notes = $6, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name, phone, email, segment, notes]
  );
  return rows[0];
}

/**
 * Upsert from a website order’s shipping fields (idempotent by phone or user).
 */
export async function upsertCustomerFromOrder(db, order) {
  const name = String(order.shipping_name || order.full_name || "").trim();
  const phone = normalizePhone(order.shipping_phone);
  const email = order.email ? String(order.email).trim().toLowerCase() : null;
  const userId = order.user_id || null;

  if (!name && !phone && !userId) {
    const err = new Error("Not enough customer info on this order");
    err.status = 400;
    throw err;
  }

  if (userId) {
    const { rows } = await db.query(`SELECT * FROM customers WHERE user_id = $1`, [userId]);
    if (rows.length) {
      const { rows: updated } = await db.query(
        `UPDATE customers
         SET name = COALESCE(NULLIF($2,''), name),
             phone = COALESCE($3, phone),
             email = COALESCE($4, email),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [rows[0].id, name, phone, email]
      );
      if (order.id) {
        await db.query(`UPDATE orders SET customer_id = $2 WHERE id = $1 AND customer_id IS NULL`, [
          order.id,
          updated[0].id,
        ]);
      }
      return updated[0];
    }
  }

  if (phone) {
    const { rows } = await db.query(
      `SELECT * FROM customers WHERE phone = $1 ORDER BY updated_at DESC LIMIT 1`,
      [phone]
    );
    if (rows.length) {
      const { rows: updated } = await db.query(
        `UPDATE customers
         SET name = COALESCE(NULLIF($2,''), name),
             email = COALESCE($3, email),
             user_id = COALESCE(user_id, $4),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [rows[0].id, name, email, userId]
      );
      if (order.id) {
        await db.query(`UPDATE orders SET customer_id = $2 WHERE id = $1`, [order.id, updated[0].id]);
      }
      return updated[0];
    }
  }

  const created = await createCustomer(db, {
    name: name || phone || email || "Customer",
    phone,
    email,
    userId,
    segment: "new",
  });
  if (order.id) {
    await db.query(`UPDATE orders SET customer_id = $2 WHERE id = $1`, [order.id, created.id]);
  }
  return created;
}
