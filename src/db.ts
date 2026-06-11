import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

let db: Database | null = null

export async function loadDb(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const res = await fetch(`${import.meta.env.BASE_URL}northwind.db`)
  if (!res.ok) throw new Error(`Failed to fetch database: ${res.status}`)
  db = new SQL.Database(new Uint8Array(await res.arrayBuffer()))
}

export type Row = Record<string, string | number | null>

export function query(sql: string, params: (string | number)[] = []): Row[] {
  if (!db) throw new Error('Database not loaded')
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: Row[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as Row)
  stmt.free()
  return rows
}
