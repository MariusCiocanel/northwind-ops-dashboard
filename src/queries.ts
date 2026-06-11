// Shared SQL for the priority metrics from the 2026-06-04 leadership sync.
// Weeks are Monday-based: date(d, 'weekday 0', '-6 days') = the Monday of d's week.

export interface Filters {
  sku: string[]
  roast: string[]
  size: string[]
  channel: string[]
}

export const emptyFilters: Filters = { sku: [], roast: [], size: [], channel: [] }

// WHERE fragment over orders aliased `o`, joined to inventory `i` (for roast).
export function whereOrders(f: Filters): { clause: string; params: string[] } {
  const parts: string[] = []
  const params: string[] = []
  const add = (col: string, vals: string[]) => {
    if (vals.length) {
      parts.push(`${col} IN (${vals.map(() => '?').join(',')})`)
      params.push(...vals)
    }
  }
  add('o.sku', f.sku)
  add('i.roast', f.roast)
  add('o.size', f.size)
  add('o.channel', f.channel)
  return { clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params }
}

const ORDERS = `orders o JOIN inventory i ON o.sku = i.sku`
export const WEEK = `date(o.order_date, 'weekday 0', '-6 days')`

export const q = {
  filterOptions: {
    sku: `SELECT sku AS v, sku || ' — ' || product AS label FROM inventory ORDER BY sku`,
    roast: `SELECT DISTINCT roast AS v, roast AS label FROM inventory WHERE roast != '-' ORDER BY roast`,
    size: `SELECT DISTINCT size AS v, size AS label FROM orders ORDER BY size`,
    channel: `SELECT DISTINCT channel AS v, channel AS label FROM orders ORDER BY channel`,
  },

  weeklyRevenue: (w: string) => `
    SELECT ${WEEK} AS week, ROUND(SUM(o.line_total), 2) AS revenue,
           COUNT(DISTINCT o.order_id) AS orders
    FROM ${ORDERS} ${w} GROUP BY week ORDER BY week`,

  aovByType: (w: string) => `
    SELECT o.order_type, ROUND(SUM(o.line_total) / COUNT(DISTINCT o.order_id), 2) AS aov,
           COUNT(DISTINCT o.order_id) AS orders, ROUND(SUM(o.line_total), 2) AS revenue
    FROM ${ORDERS} ${w} GROUP BY o.order_type`,

  // Per-SKU revenue for the last two weeks in the (filtered) data.
  movers: (w: string) => `
    WITH weekly AS (
      SELECT o.sku, o.product, ${WEEK} AS week, SUM(o.line_total) AS rev
      FROM ${ORDERS} ${w} GROUP BY o.sku, week
    ), bounds AS (SELECT MAX(week) AS last FROM weekly)
    SELECT w.sku, w.product,
      ROUND(SUM(CASE WHEN w.week = b.last THEN w.rev ELSE 0 END), 2) AS this_week,
      ROUND(SUM(CASE WHEN w.week = date(b.last, '-7 days') THEN w.rev ELSE 0 END), 2) AS prev_week
    FROM weekly w, bounds b GROUP BY w.sku
    ORDER BY this_week - prev_week DESC`,

  // 4-week-trend per SKU over the full period (for "fading" detection): first-half vs second-half revenue.
  skuTrend: (w: string) => `
    WITH bounds AS (SELECT MIN(order_date) lo, MAX(order_date) hi FROM orders),
    halves AS (
      SELECT o.sku, o.product,
        SUM(CASE WHEN o.order_date <  date((SELECT lo FROM bounds), '+' || CAST((julianday((SELECT hi FROM bounds)) - julianday((SELECT lo FROM bounds)))/2 AS INT) || ' days') THEN o.line_total ELSE 0 END) AS first_half,
        SUM(CASE WHEN o.order_date >= date((SELECT lo FROM bounds), '+' || CAST((julianday((SELECT hi FROM bounds)) - julianday((SELECT lo FROM bounds)))/2 AS INT) || ' days') THEN o.line_total ELSE 0 END) AS second_half
      FROM ${ORDERS} ${w} GROUP BY o.sku
    )
    SELECT sku, product, ROUND(first_half,2) AS first_half, ROUND(second_half,2) AS second_half,
      ROUND(CASE WHEN first_half > 0 THEN (second_half - first_half) / first_half * 100 ELSE NULL END, 1) AS pct_change
    FROM halves ORDER BY pct_change`,

  returnRateBySize: (w: string) => `
    SELECT s.size,
      sold, COALESCE(ret, 0) AS returned,
      ROUND(COALESCE(ret, 0) * 100.0 / sold, 2) AS return_rate_pct
    FROM (SELECT o.size, SUM(o.qty) AS sold FROM ${ORDERS} ${w} GROUP BY o.size) s
    LEFT JOIN (SELECT size, SUM(qty) AS ret FROM returns GROUP BY size) r ON s.size = r.size
    WHERE s.size != 'other' ORDER BY s.size`,

  mix: (w: string) => `
    SELECT o.order_type, ROUND(SUM(o.line_total), 2) AS revenue, COUNT(DISTINCT o.order_id) AS orders
    FROM ${ORDERS} ${w} GROUP BY o.order_type`,

  orderLines: (w: string) => `
    SELECT o.order_id, o.order_date, o.channel, o.order_type, o.region,
           o.sku, o.product, o.qty, o.unit_price, o.discount_code, o.line_total
    FROM ${ORDERS} ${w} ORDER BY o.order_date DESC, o.order_id DESC LIMIT 500`,

  returnsList: `
    SELECT return_id, return_date, sku, product, size, qty, refund_amount, reason
    FROM returns ORDER BY return_date DESC`,

  // Inventory health: weeks of cover, status, open inbound PO context.
  inventoryHealth: `
    SELECT inv.sku, inv.product, inv.roast, inv.size, inv.on_hand_units,
      inv.reorder_point, inv.safety_stock, inv.avg_weekly_units_4wk, inv.warehouse,
      CASE WHEN inv.avg_weekly_units_4wk > 0
           THEN ROUND(inv.on_hand_units * 1.0 / inv.avg_weekly_units_4wk, 1) END AS weeks_cover,
      po.po_number, po.qty_ordered, po.expected_arrival, po.status AS po_status,
      CASE
        WHEN (inv.on_hand_units < inv.reorder_point
              OR (inv.avg_weekly_units_4wk > 0 AND inv.on_hand_units * 1.0 / inv.avg_weekly_units_4wk < 2))
        THEN CASE WHEN po.po_number IS NULL THEN 'fire_drill' ELSE 'at_risk' END
        WHEN inv.avg_weekly_units_4wk > 0 AND inv.on_hand_units * 1.0 / inv.avg_weekly_units_4wk < 4
        THEN 'low'
        ELSE 'ok'
      END AS health
    FROM inventory inv
    LEFT JOIN inbound_pos po ON po.sku = inv.sku AND po.status != 'Received'
    ORDER BY weeks_cover IS NULL, weeks_cover`,

  // Sell-through: units sold in the last 4 weeks of data vs (sold + on hand).
  sellThrough: `
    WITH recent AS (
      SELECT sku, SUM(qty) AS sold_4wk FROM orders
      WHERE order_date >= date((SELECT MAX(order_date) FROM orders), '-27 days')
      GROUP BY sku
    )
    SELECT i.sku, i.product, COALESCE(r.sold_4wk, 0) AS sold_4wk, i.on_hand_units,
      ROUND(COALESCE(r.sold_4wk, 0) * 100.0 / NULLIF(COALESCE(r.sold_4wk, 0) + i.on_hand_units, 0), 1) AS sell_through_pct
    FROM inventory i LEFT JOIN recent r ON r.sku = i.sku
    ORDER BY sell_through_pct DESC`,

  inboundPos: `
    SELECT po_number, sku, product, supplier, qty_ordered, order_date, expected_arrival, status
    FROM inbound_pos ORDER BY status = 'Received', expected_arrival`,
}
