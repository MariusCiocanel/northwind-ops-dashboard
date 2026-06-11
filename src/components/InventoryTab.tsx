import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { query, type Row } from '../db'
import { q } from '../queries'
import KpiCard from './KpiCard'

const BADGE: Record<string, string> = {
  ok: 'OK',
  low: 'Low',
  at_risk: 'Stockout risk',
  fire_drill: 'Fire drill',
}
const COVER_COLOR = (w: number | null) => (w == null ? '#b9ada2' : w < 2 ? '#b03a2e' : w < 4 ? '#b8860b' : '#3a7d44')

type SortKey = 'weeks_cover' | 'on_hand_units' | 'avg_weekly_units_4wk' | 'sku'

export default function InventoryTab() {
  const health = useMemo(() => query(q.inventoryHealth), [])
  const sellThrough = useMemo(() => query(q.sellThrough), [])
  const pos = useMemo(() => query(q.inboundPos), [])
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'weeks_cover', asc: true })
  const [selected, setSelected] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const rows = [...health]
    rows.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      if (av == null) return 1
      if (bv == null) return -1
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.asc ? 1 : -1)
    })
    return rows
  }, [health, sort])

  const atRisk = health.filter((r) => r.health === 'at_risk' || r.health === 'fire_drill')
  const fireDrills = health.filter((r) => r.health === 'fire_drill')
  const stMap = new Map(sellThrough.map((r) => [r.sku, r]))

  const clickSort = (key: SortKey) =>
    setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))

  const coverChart = health
    .filter((r) => r.weeks_cover != null)
    .map((r) => ({ sku: r.sku, weeks_cover: Number(r.weeks_cover) }))
    .sort((a, b) => a.weeks_cover - b.weeks_cover)

  return (
    <>
      {fireDrills.length > 0 && (
        <div className="callout">
          <strong>Fire drill:</strong>{' '}
          {fireDrills.map((r) => `${r.product} (${r.sku}) — ${r.weeks_cover ?? '?'} wks of cover, no inbound PO`).join('; ')}
        </div>
      )}

      <div className="kpis">
        <KpiCard label="SKUs at stockout risk" value={String(atRisk.length)}
          note="below reorder point or under 2 weeks of cover" />
        <KpiCard label="Fire drills" value={String(fireDrills.length)}
          note="at risk with no inbound PO" />
        <KpiCard label="Open inbound POs" value={String(pos.filter((p) => p.status !== 'Received').length)}
          note={`next arrival: ${pos.find((p) => p.status !== 'Received')?.expected_arrival ?? '—'}`} />
      </div>

      <div className="panel">
        <h2>Weeks of cover by SKU<span className="hint">on hand ÷ 4-week velocity · red &lt; 2 wks, amber &lt; 4</span></h2>
        <ResponsiveContainer width="100%" height={Math.max(200, coverChart.length * 28)}>
          <BarChart data={coverChart} layout="vertical" margin={{ top: 0, right: 24, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d6" horizontal={false} />
            <XAxis type="number" fontSize={11} />
            <YAxis type="category" dataKey="sku" fontSize={11} width={90} />
            <Tooltip formatter={(v) => `${v} weeks`} />
            <Bar dataKey="weeks_cover" name="Weeks of cover">
              {coverChart.map((r) => (
                <Cell key={r.sku} fill={COVER_COLOR(r.weeks_cover)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2>Stock health<span className="hint">click a row for its inbound POs · click headers to sort</span></h2>
        <table className="data">
          <thead>
            <tr>
              <th onClick={() => clickSort('sku')}>SKU</th>
              <th>Product</th><th>Roast</th><th>Size</th>
              <th className="num" onClick={() => clickSort('on_hand_units')}>On hand</th>
              <th className="num">Reorder pt</th>
              <th className="num" onClick={() => clickSort('avg_weekly_units_4wk')}>Wkly velocity</th>
              <th className="num" onClick={() => clickSort('weeks_cover')}>Weeks cover</th>
              <th className="num">Sell-through</th>
              <th>Status</th><th>Inbound</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const st = stMap.get(r.sku)
              return (
                <tr
                  key={String(r.sku)}
                  className={`clickable ${selected === r.sku ? 'selected' : ''}`}
                  onClick={() => setSelected(selected === r.sku ? null : (r.sku as string))}
                >
                  <td>{r.sku}</td><td>{r.product}</td><td>{r.roast}</td><td>{r.size}</td>
                  <td className="num">{r.on_hand_units}</td>
                  <td className="num">{r.reorder_point}</td>
                  <td className="num">{r.avg_weekly_units_4wk}</td>
                  <td className="num" style={{ color: COVER_COLOR(r.weeks_cover as number | null), fontWeight: 700 }}>
                    {r.weeks_cover ?? 'n/a'}
                  </td>
                  <td className="num">{st?.sell_through_pct != null ? `${st.sell_through_pct}%` : '—'}</td>
                  <td><span className={`badge ${r.health}`}>{BADGE[String(r.health)]}</span></td>
                  <td>{r.po_number ? `${r.qty_ordered} units · ETA ${r.expected_arrival} (${r.po_status})` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>
          Inbound purchase orders
          {selected && <span className="hint">highlighting {selected} — <a href="#" onClick={(e) => { e.preventDefault(); setSelected(null) }}>clear</a></span>}
        </h2>
        <table className="data">
          <thead>
            <tr>
              <th>PO</th><th>SKU</th><th>Product</th><th>Supplier</th>
              <th className="num">Qty</th><th>Ordered</th><th>Expected</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(selected ? pos.filter((p) => p.sku === selected) : pos).map((p: Row) => (
              <tr key={String(p.po_number)} className={selected === p.sku ? 'selected' : ''}>
                <td>{p.po_number}</td><td>{p.sku}</td><td>{p.product}</td><td>{p.supplier}</td>
                <td className="num">{p.qty_ordered}</td><td>{p.order_date}</td>
                <td>{p.expected_arrival}</td><td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
