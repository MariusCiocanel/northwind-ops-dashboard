import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { query, type Row } from '../db'
import { q, whereOrders, type Filters } from '../queries'
import KpiCard from './KpiCard'

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd2 = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const COLORS = { sub: '#6f4e37', one: '#c8855a', up: '#3a7d44', down: '#b03a2e' }

export default function SalesTab({ filters }: { filters: Filters }) {
  const { clause, params } = whereOrders(filters)
  const [drillSku, setDrillSku] = useState<string | null>(null)

  const data = useMemo(() => {
    const weekly = query(q.weeklyRevenue(clause), params)
    const aov = query(q.aovByType(clause), params)
    const movers = query(q.movers(clause), params)
    const returns = query(q.returnRateBySize(clause), params)
    const mix = query(q.mix(clause), params)
    return { weekly, aov, movers, returns, mix }
  }, [clause, JSON.stringify(params)])

  const lines = useMemo(() => {
    const f: Filters = drillSku ? { ...filters, sku: [drillSku] } : filters
    const { clause: c, params: p } = whereOrders(f)
    return query(q.orderLines(c), p)
  }, [filters, drillSku])

  const last = data.weekly.at(-1)
  const prev = data.weekly.at(-2)
  const lastRev = Number(last?.revenue ?? 0)
  const prevRev = Number(prev?.revenue ?? 0)
  const wow = prevRev ? ((lastRev - prevRev) / prevRev) * 100 : 0

  const sub = data.aov.find((r) => r.order_type === 'Subscription')
  const one = data.aov.find((r) => r.order_type === 'One-time')

  const totalRev = data.mix.reduce((s, r) => s + Number(r.revenue), 0)
  const totalOrders = data.mix.reduce((s, r) => s + Number(r.orders), 0)
  const subMix = data.mix.find((r) => r.order_type === 'Subscription')
  const subRevShare = totalRev ? (Number(subMix?.revenue ?? 0) / totalRev) * 100 : 0
  const subOrdShare = totalOrders ? (Number(subMix?.orders ?? 0) / totalOrders) * 100 : 0

  const r12 = data.returns.find((r) => r.size === '12oz')
  const r2lb = data.returns.find((r) => r.size === '2lb')

  const moversChart = data.movers
    .map((m) => ({
      sku: String(m.sku),
      product: String(m.product),
      this_week: Number(m.this_week),
      delta: Number(m.this_week) - Number(m.prev_week),
    }))
    .filter((m) => m.delta !== 0 || m.this_week > 0)

  return (
    <>
      <div className="kpis">
        <KpiCard
          label="Net revenue (last week)"
          value={usd(lastRev)}
          delta={prev ? { pct: wow, text: `${wow >= 0 ? '+' : ''}${wow.toFixed(1)}% vs prior week (${usd(prevRev)})` } : null}
          note={`Week of ${last?.week ?? '—'}`}
        />
        <KpiCard
          label="AOV — subscription"
          value={sub ? usd2(Number(sub.aov)) : '—'}
          note={one ? `One-time: ${usd2(Number(one.aov))}` : undefined}
        />
        <KpiCard
          label="Return rate — 2lb bags"
          value={r2lb ? `${Number(r2lb.return_rate_pct).toFixed(1)}%` : '—'}
          note={r12 ? `12oz: ${Number(r12.return_rate_pct).toFixed(1)}% · ${r2lb?.returned ?? 0} of ${r2lb?.sold ?? 0} units` : undefined}
        />
        <KpiCard
          label="Subscription mix"
          value={`${subRevShare.toFixed(0)}% of revenue`}
          note={`${subOrdShare.toFixed(0)}% of orders`}
        />
      </div>

      <div className="panel">
        <h2>Weekly net revenue<span className="hint">sum of line totals, net of discounts</span></h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.weekly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d6" />
            <XAxis dataKey="week" fontSize={11} tickFormatter={(w: string) => w.slice(5)} />
            <YAxis fontSize={11} tickFormatter={(v: number) => usd(v)} width={70} />
            <Tooltip formatter={(v) => usd2(Number(v))} labelFormatter={(w) => `Week of ${w}`} />
            <Line type="monotone" dataKey="revenue" stroke={COLORS.sub} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Movers — last week vs prior<span className="hint">click a bar to drill into orders</span></h2>
          <ResponsiveContainer width="100%" height={Math.max(220, moversChart.length * 26)}>
            <BarChart data={moversChart} layout="vertical" margin={{ top: 0, right: 16, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d6" horizontal={false} />
              <XAxis type="number" fontSize={11} tickFormatter={(v: number) => usd(v)} />
              <YAxis type="category" dataKey="sku" fontSize={11} width={90} />
              <Tooltip
                formatter={(v) => usd2(Number(v))}
                labelFormatter={(sku) => {
                  const m = moversChart.find((x) => x.sku === sku)
                  return `${m?.product ?? sku} — Δ ${usd2(Number(m?.delta ?? 0))}`
                }}
              />
              <Bar dataKey="delta" name="WoW change" onClick={(d) => setDrillSku((d as unknown as Row).sku as string)} cursor="pointer">
                {moversChart.map((m) => (
                  <Cell key={String(m.sku)} fill={m.delta >= 0 ? COLORS.up : COLORS.down} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>Subscription vs one-time</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.mix.map((m) => ({ name: m.order_type, value: Number(m.revenue) }))}
                dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
              >
                {data.mix.map((m) => (
                  <Cell key={String(m.order_type)} fill={m.order_type === 'Subscription' ? COLORS.sub : COLORS.one} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => usd2(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <h2>
          Order detail
          {drillSku && <span className="hint">filtered to {drillSku} — <a href="#" onClick={(e) => { e.preventDefault(); setDrillSku(null) }}>clear</a></span>}
          <span className="hint">latest 500 lines</span>
        </h2>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Order</th><th>Date</th><th>Channel</th><th>Type</th><th>Region</th>
                <th>SKU</th><th>Product</th><th className="num">Qty</th>
                <th className="num">Unit $</th><th>Code</th><th className="num">Line total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((r, i) => (
                <tr key={i}>
                  <td>{r.order_id}</td><td>{r.order_date}</td><td>{r.channel}</td>
                  <td>{r.order_type}</td><td>{r.region}</td><td>{r.sku}</td><td>{r.product}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{usd2(Number(r.unit_price))}</td>
                  <td>{r.discount_code ?? ''}</td>
                  <td className="num">{usd2(Number(r.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
