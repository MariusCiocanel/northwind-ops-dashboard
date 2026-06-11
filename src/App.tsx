import { useEffect, useState } from 'react'
import { loadDb } from './db'
import { emptyFilters, type Filters } from './queries'
import FilterBar from './components/FilterBar'
import SalesTab from './components/SalesTab'
import InventoryTab from './components/InventoryTab'

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'sales' | 'inventory'>('sales')
  const [filters, setFilters] = useState<Filters>(emptyFilters)

  useEffect(() => {
    loadDb().then(() => setReady(true), (e) => setError(String(e)))
  }, [])

  if (error) return <div className="error">Couldn’t load the database: {error}</div>
  if (!ready) return <div className="loading">Brewing the numbers…</div>

  return (
    <div className="app">
      <header className="masthead">
        <h1><span className="bean">●</span> Northwind Coffee — Ops Dashboard</h1>
        <span className="sub">Orders 2026-03-09 → 2026-05-31 · Inventory snapshot 2026-06-01</span>
      </header>

      <nav className="tabs">
        <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>Sales</button>
        <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>Inventory</button>
      </nav>

      {tab === 'sales' && (
        <>
          <FilterBar filters={filters} onChange={setFilters} />
          <SalesTab filters={filters} />
        </>
      )}
      {tab === 'inventory' && <InventoryTab />}
    </div>
  )
}
