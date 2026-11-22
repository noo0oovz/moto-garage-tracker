import { useMemo, useState } from 'react'
import { Fuel, Paperclip, Plus, Trash2, ShieldCheck, Wrench, Cog } from 'lucide-react'
import { useStore } from './store'
import { Empty } from './ui'
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
    <div className="page space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold">Fuel Logs</h2>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-800 p-6 text-center text-white shadow-lg">
        <p className="text-sm opacity-90">Total Fuel Expenses</p>
        <p className="my-1 text-4xl font-extrabold tracking-tight">{peso(data.total, 2)}</p>
        <p className="text-sm opacity-90">
          {num(data.liters, 2)} Liters Total{data.eff.avg ? ` · ${data.eff.avg.toFixed(1)} km/L avg` : ''}
        </p>
      </div>

      {data.rows.length === 0 ? <Empty>No fuel logs in this period.</Empty> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.rows.map((f) => (
            <li key={f.id} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">{fmtDate(f.date)}</p>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-orange-500">{peso(f.totalCost, 2)}</span>
                  <button aria-label="Delete fuel log" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:text-red-500"
                    onClick={() => { if (confirm('Delete this fuel log?')) deleteLog('fuel', f.id) }}><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div><p>Mileage</p><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{num(f.odometer)} km</p></div>
                <div><p>Volume</p><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{num(f.liters, 2)} L</p></div>
                <div><p>Efficiency</p><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data.eff.map[f.id] ? `${data.eff.map[f.id].toFixed(1)} km/L` : '—'}</p></div>
              </div>
              {(f.station || !f.fullTank) && (
                <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">{f.station}{!f.fullTank ? ' · partial fill' : ''}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => open({ kind: 'log', tab: 'fuel' })} aria-label="Log fuel"
        className="btn-primary fixed bottom-24 right-4 z-20 rounded-full px-5 shadow-xl shadow-orange-500/30 md:bottom-6 md:right-6">
        <Fuel size={18} /> LOG FUEL
      </button>
    </div>
  )
}

export function HistoryPage() {
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
    <div className="page space-y-4">
      <div className="card p-4 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">Total Service Spend YTD</p>
        <p className="text-3xl font-extrabold tracking-tight">{peso(ytd, 2)}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="field sm:flex-1" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} />
        <RangeSelect value={range} onChange={setRange} />
      </div>
      {rows.length === 0 ? <Empty>No service history yet. Tap “Mark Serviced” on a maintenance item to record one.</Empty> : (
        <ol className="grid gap-3 md:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id} className="card relative overflow-hidden p-4 pl-5">
              <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-orange-500" aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 text-sm font-bold leading-snug">{s.name}</h3>
                <button aria-label="Delete service record" className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-red-500"
                  onClick={() => { if (confirm('Delete this service record (and its linked expense)?')) deleteService(s.id) }}><Trash2 size={16} /></button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{num(s.odometer)} km · {fmtDate(s.date)}{s.shopName ? ` · ${s.shopName}` : ''}</p>
              <p className="mt-2 flex items-center justify-between text-base font-bold">
                {s.cost ? peso(s.cost, 2) : <span className="text-sm font-medium text-slate-400">No cost recorded</span>}
                <Paperclip size={16} className="text-slate-400" aria-hidden />
              </p>
            </li>
          ))}
        </ol>
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
    <div className="page space-y-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Parts &amp; Accessories Spend</p>
          <p className="text-2xl font-extrabold tracking-tight">{peso(total, 2)}</p>
        </div>
        <button className="btn-primary" onClick={() => open({ kind: 'part' })}><Plus size={16} /> Add part</button>
      </div>
      <select className="field sm:w-64" aria-label="Part type filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
        {types.map((t) => <option key={t}>{t}</option>)}
      </select>
      {rows.length === 0 ? <Empty>No parts recorded yet.</Empty> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const w = warrantyInfo(p)
            return (
              <li key={p.id} className="card relative overflow-hidden p-4 pl-5">
                <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-orange-500" aria-hidden />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-sm font-bold"><Cog size={14} className="shrink-0 text-orange-500" /> <span className="truncate">{p.partType}</span></h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {[p.brand, p.description, p.partNumber && `#${p.partNumber}`].filter(Boolean).join(' · ') || p.condition}
                    </p>
                  </div>
                  <button aria-label="Delete part" className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-red-500"
                    onClick={() => { if (confirm('Delete this part record (and its linked expense)?')) deletePart(p.id) }}><Trash2 size={16} /></button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.condition} · {num(p.installedKm)} km · {fmtDate(p.date)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-base font-bold">{peso(p.amount, 2)}</span>
                  {w && (
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${w.active ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/15 text-slate-500'}`}>
                      <ShieldCheck size={12} /> {w.active ? `Warranty ${w.days}d left` : 'Warranty expired'}
                    </span>
                  )}
                </div>
                {p.notes && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{p.notes}</p>}
              </li>
            )
          })}
        </ul>
      )}
      <p className="flex items-center gap-1 text-xs text-slate-500"><Wrench size={12} /> Each part also appears in your Logs ledger as “Wear &amp; Tear Parts”.</p>
    </div>
  )
}
