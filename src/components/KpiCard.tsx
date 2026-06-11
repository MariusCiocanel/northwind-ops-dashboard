export default function KpiCard({
  label,
  value,
  delta,
  note,
}: {
  label: string
  value: string
  delta?: { pct: number; text: string } | null
  note?: string
}) {
  const dir = delta == null ? null : delta.pct > 0.5 ? 'up' : delta.pct < -0.5 ? 'down' : 'flat'
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '–'
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta != null && (
        <div className={`delta ${dir}`}>
          {arrow} {delta.text}
        </div>
      )}
      {note && <div className="note">{note}</div>}
    </div>
  )
}
