import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from './store'
import { Empty, ListCard, PageHeader, Stat } from './ui'
import { IconBtn } from './pages'
import { PartIcon } from './PartIcon'
import type { ModalState } from './modals'
import { fmtDate, fuelEfficiency, inRange, num, peso, warrantyInfo } from './logic'

type Open = (m: ModalState) => void

const RANGES: { label: string; days: number | null }[] = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 1 year', days: 365 },
  { label: 'All time', days: null },
]

function RangeSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <select className="field sm:w-52" aria-label="Date filter" value={String(value)} onChange={(e) => onChange(e.target.value === 'null' ? null : Number(e.target.value))}>
      {RANGES.map((r) => <option key={r.label} value={String(r.days)}>{r.label}</option>)}
    </select>
  )
}

export function FuelPage({ open }: { open: Open }) {
  const { state, vehicle, deleteLog } = useStore()
  const [range, setRange] = useState<number | null>(365)
  const data = useMemo(() => {
    if (!vehicle) return null
    const all = state.fuel.filter((f) => f.vehicleId === vehicle.id)
    const eff = fuelEfficiency(all)
    const rows = all.filter((f) => inRange(f.date, range)).sort((a, b) => (a.date < b.date ? 1 : -1))
    return {
      rows, eff,
      total: rows.reduce((s, r) => s + r.totalCost, 0),
      liters: rows.reduce((s, r) => s + r.liters, 0),
    }
  }, [state.fuel, vehicle, range])
  if (!vehicle || !data) return <Empty>No vehicle selected.</Empty>

  return (
    <div className="page space-y-5">
      <PageHeader title="Fuel logs" sub={`${data.rows.length} ${data.rows.length === 1 ? 'fill-up' : 'fill-ups'}`} />
      <RangeSelect value={range} onChange={setRange} />

      <section className="card grid grid-cols-2 gap-x-4 gap-y-4 p-4" aria-label="Fuel summary">
        {/* the spend is the headline, so it gets the full width and a number can never be split across two lines */}
        <div className="col-span-2"><Stat label="Spent" value={peso(data.total, 2)} /></div>
        <Stat label="Litres" value={num(data.liters, 1)} />
        <Stat label="Average" value={data.eff.avg ? `${data.eff.avg.toFixed(1)} km/L` : '—'} />
      </section>

      {data.rows.length === 0 ? <Empty>No fuel logs in this period.</Empty> : (
        <ListCard label="Fuel logs">
          {data.rows.map((f) => {
            const eff = data.eff.map[f.id]
            return (
              <li key={f.id} className="flex items-center gap-3 py-2.5 pl-4 pr-1" style={{ borderColor: 'var(--hairline)' }}>
                <div className="min-w-0 flex-1">
                  <p className="num break-words text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{fmtDate(f.date)}{f.station ? <span style={{ color: 'var(--text-2)' }}> · {f.station}</span> : null}</p>
                  <p className="num text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
                    {num(f.odometer)} km · {num(f.liters, 1)} L{!f.fullTank ? ' · partial' : ''}
                  </p>
                </div>
                <div className="num shrink-0 text-right leading-snug">
                  <p className="text-[15px] font-semibold">{peso(f.totalCost, 2)}</p>
                  <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{eff ? `${eff.toFixed(1)} km/L` : ' '}</p>
                </div>
                <div className="flex shrink-0">
                  <IconBtn label="Edit fuel log" onClick={() => open({ kind: 'log', tab: 'fuel', editFuel: f })}><Pencil size={16} /></IconBtn>
                  <IconBtn label="Delete fuel log" onClick={() => { if (confirm('Delete this fuel log?')) deleteLog('fuel', f.id) }}><Trash2 size={16} /></IconBtn>
                </div>
              </li>
            )
          })}
        </ListCard>
      )}
    </div>
  )
}

export function HistoryPage({ open }: { open: Open }) {
  const { state, vehicle, deleteService } = useStore()
  const [range, setRange] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    if (!vehicle) return []
    return state.services
      .filter((s) => s.vehicleId === vehicle.id && inRange(s.date, range) && (!q || s.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [state.services, vehicle, range, q])
  if (!vehicle) return <Empty>No vehicle selected.</Empty>

  const year = String(new Date().getFullYear())
  const ytd = state.services.filter((s) => s.vehicleId === vehicle.id && s.date.startsWith(year)).reduce((t, s) => t + (s.cost ?? 0), 0)

  return (
    <div className="page space-y-5">
      <PageHeader title="Service history" sub={`${rows.length} ${rows.length === 1 ? 'record' : 'records'}`} />
      <section className="card p-4" aria-label="Service spend this year"><Stat label={`Service spend ${year}`} value={peso(ytd, 2)} /></section>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="field sm:flex-1" placeholder="Search services…" aria-label="Search services" value={q} onChange={(e) => setQ(e.target.value)} />
        <RangeSelect value={range} onChange={setRange} />
      </div>
      {rows.length === 0 ? <Empty>No service history yet. Tap “Mark Serviced” on a maintenance item to record one.</Empty> : (
        <ListCard label="Service records">
          {rows.map((s) => (
            <li key={s.id} className="py-3 pl-4 pr-1" style={{ borderColor: 'var(--hairline)' }}>
              <div className="flex items-start gap-3">
                <PartIcon item={{ name: s.name }} tone="check" size={36} round />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{s.name}</p>
                    <span className="num shrink-0 text-[15px] font-semibold" style={s.cost ? undefined : { color: 'var(--text-3)', fontWeight: 400 }}>{s.cost ? peso(s.cost, 2) : 'No cost'}</span>
                  </div>
                  <p className="num text-[13px] leading-snug [overflow-wrap:anywhere]" style={{ color: 'var(--text-2)' }}>{fmtDate(s.date)} · {num(s.odometer)} km{s.shopName ? ` · ${s.shopName}` : ''}</p>
                </div>
                <div className="-mt-1 flex shrink-0">
                  <IconBtn label="Edit service record" onClick={() => open({ kind: 'editService', item: s })}><Pencil size={16} /></IconBtn>
                  <IconBtn label="Delete service record" onClick={() => { if (confirm('Delete this service record (and its linked expense)?')) deleteService(s.id) }}><Trash2 size={16} /></IconBtn>
                </div>
              </div>
            </li>
          ))}
        </ListCard>
      )}
    </div>
  )
}

export function PartsPage({ open }: { open: Open }) {
  const { state, vehicle, deletePart } = useStore()
  const [filter, setFilter] = useState('All')
  const all = useMemo(
    () => (vehicle ? state.parts.filter((p) => p.vehicleId === vehicle.id).sort((a, b) => (a.date < b.date ? 1 : -1)) : []),
    [state.parts, vehicle],
  )
  if (!vehicle) return <Empty>No vehicle selected.</Empty>
  const types = ['All', ...Array.from(new Set(all.map((p) => p.partType)))]
  const rows = all.filter((p) => filter === 'All' || p.partType === filter)
  const total = all.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="page space-y-5">
      <PageHeader title="Parts" sub={`${all.length} ${all.length === 1 ? 'part' : 'parts'} · ${peso(total, 2)}`}
        action={<button className="btn-primary" onClick={() => open({ kind: 'part' })}><Plus size={16} /> Add part</button>} />
      <select className="field sm:w-64" aria-label="Part type filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
        {types.map((t) => <option key={t}>{t}</option>)}
      </select>
      {rows.length === 0 ? <Empty>No parts recorded yet.</Empty> : (
        <ListCard label="Parts">
          {rows.map((p) => {
            const w = warrantyInfo(p)
            const detail = [p.brand, p.description, p.partNumber && `#${p.partNumber}`].filter(Boolean).join(' · ') || p.condition
            return (
              <li key={p.id} className="py-3 pl-4 pr-1" style={{ borderColor: 'var(--hairline)' }}>
                <div className="flex items-start gap-3">
                  <PartIcon item={{ name: p.partType }} tone="check" size={36} round />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{p.partType}</p>
                      <span className="num shrink-0 text-[15px] font-semibold">{peso(p.amount, 2)}</span>
                    </div>
                    <p className="text-[13px] leading-snug [overflow-wrap:anywhere]" style={{ color: 'var(--text-2)' }}>{detail}</p>
                    <p className="num text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
                      {fmtDate(p.date)} · {num(p.installedKm)} km
                      {w && <span style={{ color: w.active ? 'var(--ok)' : 'var(--text-3)' }}> · {w.active ? `Warranty ${w.days}d left` : 'Warranty expired'}</span>}
                    </p>
                    {p.notes && <p className="text-[13px] leading-snug [overflow-wrap:anywhere]" style={{ color: 'var(--text-2)' }}>{p.notes}</p>}
                  </div>
                  <div className="-mt-1 flex shrink-0">
                    <IconBtn label="Edit part" onClick={() => open({ kind: 'part', item: p })}><Pencil size={16} /></IconBtn>
                    <IconBtn label="Delete part" onClick={() => { if (confirm('Delete this part record (and its linked expense)?')) deletePart(p.id) }}><Trash2 size={16} /></IconBtn>
                  </div>
                </div>
              </li>
            )
          })}
        </ListCard>
      )}
      <p className="px-1 text-[13px]" style={{ color: 'var(--text-2)' }}>Each part also appears in your Logs ledger as “Wear &amp; Tear Parts”.</p>
    </div>
  )
}
