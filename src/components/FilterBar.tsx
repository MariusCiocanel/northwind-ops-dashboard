import { useMemo } from 'react'
import { query } from '../db'
import { q, type Filters } from '../queries'

const FIELDS = [
  { key: 'sku', label: 'SKU' },
  { key: 'roast', label: 'Roast' },
  { key: 'size', label: 'Size' },
  { key: 'channel', label: 'Channel' },
] as const

export default function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const options = useMemo(
    () =>
      Object.fromEntries(
        FIELDS.map(({ key }) => [key, query(q.filterOptions[key]) as { v: string; label: string }[]])
      ),
    []
  )

  const add = (key: keyof Filters, v: string) => {
    if (v && !filters[key].includes(v)) onChange({ ...filters, [key]: [...filters[key], v] })
  }
  const remove = (key: keyof Filters, v: string) =>
    onChange({ ...filters, [key]: filters[key].filter((x) => x !== v) })
  const active = FIELDS.flatMap(({ key, label }) => filters[key].map((v) => ({ key, label, v })))

  return (
    <div className="filterbar">
      {FIELDS.map(({ key, label }) => (
        <label key={key}>
          {label}
          <select value="" onChange={(e) => add(key, e.target.value)}>
            <option value="">All ({options[key].length})</option>
            {options[key].map((o) => (
              <option key={o.v} value={o.v} disabled={filters[key].includes(o.v)}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {active.length > 0 && (
        <>
          <button className="clear" onClick={() => onChange({ sku: [], roast: [], size: [], channel: [] })}>
            Clear all
          </button>
          <div className="chips">
            {active.map(({ key, label, v }) => (
              <span key={key + v} className="chip">
                {label}: {v}
                <button onClick={() => remove(key, v)} aria-label={`Remove ${label} ${v}`}>×</button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
