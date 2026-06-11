// ETL: load the team's spreadsheets into SQLite.
// Each sheet holds two tables stacked vertically (banner row, header row,
// data rows, blank separator), so we scan for header rows by anchor column
// instead of assuming fixed offsets.
import { readFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as XLSX from 'xlsx'
import Database from 'better-sqlite3'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = path.join(root, 'data', 'northwind.db')

type Cell = string | number | Date | null | undefined
type Row = Cell[]

function readSheet(file: string, sheet: string): Row[] {
  const wb = XLSX.read(readFileSync(path.join(root, 'data', file)), { cellDates: true })
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`Sheet "${sheet}" not found in ${file}`)
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null })
}

// Find the table whose header row starts with `anchor`, return its data rows
// keyed by header name. Stops at the first fully blank row.
function extractTable(rows: Row[], anchor: string): Record<string, Cell>[] {
  const headerIdx = rows.findIndex((r) => r[0] === anchor)
  if (headerIdx === -1) throw new Error(`No header row starting with "${anchor}"`)
  const headers = rows[headerIdx].filter((h): h is string => typeof h === 'string')
  const out: Record<string, Cell>[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === null || c === '')) break
    const rec: Record<string, Cell> = {}
    headers.forEach((h, j) => (rec[h] = row[j]))
    out.push(rec)
  }
  return out
}

// Use local date parts — toISOString() shifts dates a day early west of UTC.
const iso = (d: Cell): string | null =>
  d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : d == null
      ? null
      : String(d)

// Size for sales/returns rows comes from the SKU suffix.
const sizeFromSku = (sku: Cell): string =>
  String(sku).endsWith('-2LB') ? '2lb' : String(sku).endsWith('-12') ? '12oz' : 'other'

const sales = readSheet('sales.xlsx', 'Sales Data')
const orders = extractTable(sales, 'order_id')
const returns = extractTable(sales, 'return_id')
const inv = readSheet('inventory.xlsx', 'Inventory')
const onHand = extractTable(inv, 'sku')
const pos = extractTable(inv, 'po_number')

rmSync(dbPath, { force: true })
mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
db.exec(`
  CREATE TABLE orders (
    order_id TEXT NOT NULL, order_date TEXT NOT NULL, channel TEXT, order_type TEXT,
    region TEXT, sku TEXT NOT NULL, product TEXT, qty INTEGER,
    unit_price REAL, discount_code TEXT, line_total REAL NOT NULL, size TEXT
  );
  CREATE TABLE returns (
    return_id TEXT NOT NULL, order_id TEXT, return_date TEXT, sku TEXT,
    product TEXT, qty INTEGER, refund_amount REAL, reason TEXT, size TEXT
  );
  CREATE TABLE inventory (
    sku TEXT PRIMARY KEY, product TEXT, roast TEXT, size TEXT,
    on_hand_units INTEGER, reorder_point INTEGER, safety_stock INTEGER,
    avg_weekly_units_4wk REAL, warehouse TEXT, last_counted TEXT
  );
  CREATE TABLE inbound_pos (
    po_number TEXT NOT NULL, sku TEXT, product TEXT, supplier TEXT,
    qty_ordered INTEGER, order_date TEXT, expected_arrival TEXT, status TEXT
  );
`)

const insertMany = (table: string, cols: string[], rows: Record<string, Cell>[], map: (r: Record<string, Cell>) => unknown[]) => {
  const stmt = db.prepare(`INSERT INTO ${table} VALUES (${cols.map(() => '?').join(',')})`)
  db.transaction(() => rows.forEach((r) => stmt.run(...map(r))))()
}

insertMany('orders', Array(12).fill(''), orders, (r) => [
  r.order_id, iso(r.order_date), r.channel, r.order_type, r.region, r.sku,
  r.product, r.qty, r.unit_price, r.discount_code, r.line_total, sizeFromSku(r.sku),
])
insertMany('returns', Array(9).fill(''), returns, (r) => [
  r.return_id, r.order_id, iso(r.return_date), r.sku, r.product, r.qty,
  r.refund_amount, r.reason, sizeFromSku(r.sku),
])
insertMany('inventory', Array(10).fill(''), onHand, (r) => [
  r.sku, r.product, r.roast, r.size, r.on_hand_units, r.reorder_point,
  r.safety_stock, r.avg_weekly_units_4wk, r.warehouse, iso(r.last_counted),
])
insertMany('inbound_pos', Array(8).fill(''), pos, (r) => [
  r.po_number, r.sku, r.product, r.supplier, r.qty_ordered, iso(r.order_date),
  iso(r.expected_arrival), r.status,
])

db.close()
copyFileSync(dbPath, path.join(root, 'public', 'northwind.db'))
console.log(
  `Loaded: ${orders.length} order lines, ${returns.length} returns, ${onHand.length} inventory SKUs, ${pos.length} POs → ${dbPath} (+ public/northwind.db)`
)
