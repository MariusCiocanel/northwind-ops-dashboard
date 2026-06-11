// Verifies the spreadsheets loaded into SQLite correctly. Run `npm run etl` first
// (the test fails loudly if the DB is missing).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'northwind.db')
let db: Database.Database

beforeAll(() => {
  db = new Database(dbPath, { readonly: true, fileMustExist: true })
})
afterAll(() => db?.close())

const one = <T = Record<string, unknown>>(sql: string) => db.prepare(sql).get() as T

describe('data loaded from spreadsheets', () => {
  it('has rows in all four tables', () => {
    expect(one<{ n: number }>('SELECT COUNT(*) n FROM orders').n).toBeGreaterThan(500)
    expect(one<{ n: number }>('SELECT COUNT(*) n FROM returns').n).toBeGreaterThan(0)
    expect(one<{ n: number }>('SELECT COUNT(*) n FROM inventory').n).toBe(14)
    expect(one<{ n: number }>('SELECT COUNT(*) n FROM inbound_pos').n).toBeGreaterThan(0)
  })

  it('matches known facts from the source sheets', () => {
    const eth = one<{ on_hand_units: number; reorder_point: number }>(
      "SELECT on_hand_units, reorder_point FROM inventory WHERE sku = 'NW-ETH-12'"
    )
    expect(eth).toEqual({ on_hand_units: 4, reorder_point: 18 })
    // Net revenue snapshot — recomputed from the sheet, guards against parser drift.
    const rev = one<{ total: number }>('SELECT ROUND(SUM(line_total), 2) total FROM orders')
    expect(rev.total).toBe(15190.22)
  })

  it('has clean order data', () => {
    expect(
      one<{ n: number }>("SELECT COUNT(*) n FROM orders WHERE line_total IS NULL OR order_date IS NULL").n
    ).toBe(0)
    const range = one<{ lo: string; hi: string }>('SELECT MIN(order_date) lo, MAX(order_date) hi FROM orders')
    expect(range.lo >= '2026-03-09' && range.hi <= '2026-05-31').toBe(true)
  })

  it('every sales and PO sku exists in inventory', () => {
    expect(
      one<{ n: number }>(
        'SELECT COUNT(*) n FROM (SELECT sku FROM orders UNION SELECT sku FROM returns UNION SELECT sku FROM inbound_pos) WHERE sku NOT IN (SELECT sku FROM inventory)'
      ).n
    ).toBe(0)
  })

  it('derived size matches sku suffix', () => {
    expect(
      one<{ n: number }>("SELECT COUNT(*) n FROM orders WHERE (size = '2lb') != (sku LIKE '%-2LB')").n
    ).toBe(0)
    expect(one<{ n: number }>("SELECT COUNT(*) n FROM orders WHERE size = '2lb'").n).toBeGreaterThan(0)
  })
})
