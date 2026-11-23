import { useMemo, useState } from 'react'
import { Check, Fuel, Gauge, Pencil, Plus, RotateCcw, Trash2, Wallet, Wrench, Car, Bike, TrendingUp } from "lucide-react"
import { useStore } from './store'
import { Empty, Progress } from './ui'
import type { ModalState } from './modals'
import { buildLedger, fmtDate, loggedKmSpan, num, peso, spendSummary } from "./logic"
import { CHECKLIST_CAR, CHECKLIST_MOTO } from './data'
import { useMinWidth } from './useLayout'

type Open = (m: ModalState) => void

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Gauge; label: string; value: string; sub?: string }) {
  return (
    <div className="card min-w-0 p-4">
      <p className="mb-1 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--text-2)' }}><Icon size={14} aria-hidden /> {label}</p>
      <p className="num break-words text-[22px] font-bold leading-tight tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-2)' }}>{sub}</p>}
    </div>
  )
}

export function LogsPage({ open }: { open: Open }) {
  const { state, vehicle, deleteLog } = useStore()
  const [filter, setFilter] = useState('All')
  const [limit, setLimit] = useState(100)
  const wide = useMinWidth(1280)
  const [q, setQ] = useState('')
  const rows = useMemo(() => (vehicle ? buildLedger(state.fuel, state.expenses, vehicle.id) : []), [state, vehicle])
  const sum = useMemo(() => (vehicle ? spendSummary(rows, loggedKmSpan(state.fuel, state.expenses, vehicle.id)) : null), [rows, state, vehicle])
  if (!vehicle || !sum) return <Empty>No vehicle selected.</Empty>

  const cats = ['All', ...Object.keys(sum.byCat)]
  const needle = q.trim().toLowerCase()
  const shown = rows.filter((r) => (filter === 'All' || r.category === filter) &&
    (!needle || `${r.place} ${r.desc} ${r.category}`.toLowerCase().includes(needle)))
  const max = Math.max(1, ...Object.values(sum.byCat))
  const visible = shown.slice(0, limit)
  const del = (r: (typeof rows)[number]) => { if (confirm('Delete this entry?')) deleteLog(r.kind, r.id) }
  // Set lookup: a per-row find() over every expense is O(rows x expenses) and freezes the page on a big ledger.
  const linkedIds = new Set(state.expenses.filter((x) => x.sourceId).map((x) => x.id))
  const linked = (r: (typeof rows)[number]) => r.kind === 'expense' && linkedIds.has(r.id)
  const edit = (r: (typeof rows)[number]) => {
    if (r.kind === 'fuel') {
      const f = state.fuel.find((x) => x.id === r.id)
      if (f) open({ kind: 'log', tab: 'fuel', editFuel: f })
    } else {
      const x = state.expenses.find((e) => e.id === r.id)
      if (x) open({ kind: 'log', tab: 'expense', editExpense: x })
    }
  }
  const EditBtn = ({ r }: { r: (typeof rows)[number] }) => linked(r) ? (
    <span className="grid h-11 w-11 place-items-center text-slate-300" title="Edit this from Service History or Parts"><Pencil size={16} /></span>
  ) : (
    <button aria-label="Edit" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:text-orange-500" onClick={() => edit(r)}><Pencil size={16} /></button>
  )

  return (
    <div className="page space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Wallet} label="This month" value={peso(sum.thisMonth)} />
        <Kpi icon={Wallet} label="All time" value={peso(sum.all)} />
        <Kpi icon={TrendingUp} label="Cost per km" value={sum.perKm ? `${peso(sum.perKm, 2)}` : '—'} sub="₱ per km logged" />
        <Kpi icon={Fuel} label="Entries" value={String(rows.length)} />
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-bold">Spend by category</h2>
        {Object.keys(sum.byCat).length === 0 ? <p className="text-sm text-slate-500">Nothing logged yet.</p> : (
          <ul className="space-y-3">
            {Object.entries(sum.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
              <li key={c}>
                <div className="mb-1 flex justify-between text-xs"><span>{c}</span><span className="font-semibold">{peso(v)} · {Math.round((v / sum.all) * 100)}%</span></div>
                <Progress pct={(v / max) * 100} className="bg-orange-500" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-bold">Ledger</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="field sm:w-56" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(100) }} />
            <select className="field sm:w-52" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(100) }}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {shown.length === 0 ? <Empty>No entries match.</Empty> : (
          <>
            {/* Mobile / tablet cards */}
            {!wide && <ul className="grid gap-2 md:grid-cols-2">
              {visible.map((r) => (
                <li key={r.id} className="card flex items-center gap-3 p-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${r.kind === 'fuel' ? 'bg-slate-100 text-slate-500' : 'bg-orange-500/15 text-orange-500'}`}>
                    {r.kind === 'fuel' ? <Fuel size={18} /> : <Wrench size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold">{r.category}{r.place ? ` · ${r.place}` : ''}</p>
                    <p className="break-words text-xs text-slate-500">
                      {fmtDate(r.date)}{r.odometer ? ` · ${num(r.odometer)} km` : ''}{r.kmPerL ? ` · ${r.kmPerL.toFixed(1)} km/L` : ''}
                    </p>
                    {r.desc && <p className="break-words text-xs text-slate-500">{r.desc}</p>}
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{peso(r.cost, 2)}</span>
                  <div className="flex shrink-0 flex-col min-[420px]:flex-row">
                    <EditBtn r={r} />
                    <button aria-label="Delete" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:text-red-500" onClick={() => del(r)}><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>}
            {/* Desktop table */}
            {wide && <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>{['Date', 'Category', 'Shop / Station', 'Details', 'Odometer', 'km/L', 'Cost', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visible.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3">{r.category}</td>
                      <td className="px-4 py-3">{r.place || '—'}</td>
                      <td className="min-w-[10rem] max-w-xs break-words px-4 py-3 text-slate-500">{r.desc || '—'}</td>
                      <td className="px-4 py-3">{r.odometer ? `${num(r.odometer)} km` : '—'}</td>
                      <td className="px-4 py-3">{r.kmPerL ? r.kmPerL.toFixed(1) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{peso(r.cost, 2)}</td>
                      <td className="whitespace-nowrap px-2 py-1"><div className="flex"><EditBtn r={r} /><button aria-label="Delete" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:text-red-500" onClick={() => del(r)}><Trash2 size={16} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
            {shown.length > limit && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <p className="text-xs text-slate-500">Showing {limit} of {shown.length} entries</p>
                <button className="btn-ghost" onClick={() => setLimit((l) => l + 200)}>Show 200 more</button>
              </div>
            )}
          </>
        )}
        <button className="btn-primary mt-4 md:hidden" onClick={() => open({ kind: 'log', tab: 'fuel' })}><Plus size={16} /> New log</button>
      </section>
    </div>
  )
}

export function ChecklistPage() {
  const { state, vehicle, toggleCheck, resetChecklist } = useStore()
  if (!vehicle) return <Empty>No vehicle selected.</Empty>
  const list = vehicle.type === 'car' ? CHECKLIST_CAR : CHECKLIST_MOTO
  const checked = state.checklist[vehicle.id] ?? []
  const done = list.filter((i) => checked.includes(i.key)).length
  const half = Math.ceil(list.length / 2)
  const groups = [
    { title: vehicle.type === 'car' ? 'BLOWBAGETS · Vehicle' : 'BLOWBAGETS · Bike', items: list.slice(0, half) },
    { title: vehicle.type === 'car' ? 'Gear & Driver' : 'Gear & Rider', items: list.slice(half) },
  ]
  return (
    <div className="page space-y-4">
      <div className="card flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Pre-Trip Safety Check</h2>
          <p className="text-xs text-slate-500">{done}/{list.length} checked · {vehicle.nickname}</p>
          <div className="mt-2"><Progress pct={(done / list.length) * 100} className={done === list.length ? 'bg-emerald-500' : 'bg-orange-500'} /></div>
        </div>
        <button className="btn-ghost" onClick={() => resetChecklist(vehicle.id)}><RotateCcw size={16} /> Reset</button>
      </div>
      {done === list.length && <div className="anim-pop rounded-2xl bg-emerald-500/15 p-3 text-center text-sm font-semibold text-emerald-600">All clear — ride safe! 🏁</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="card p-2">
            <h3 className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{g.title}</h3>
            <ul>
              {g.items.map((i) => {
                const on = checked.includes(i.key)
                return (
                  <li key={i.key}>
                    <button onClick={() => toggleCheck(vehicle.id, i.key)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-slate-50" aria-pressed={on}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${on ? 'border-emerald-500 on-ok' : 'border-slate-300'}`}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${on ? 'text-slate-400 line-through' : ''}`}>{i.label}</span>
                        <span className="block text-xs text-slate-500">{i.hint}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export function VehiclesPage({ open }: { open: Open }) {
  const { state, setActive, deleteVehicle } = useStore()
  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Vehicles</h2>
        <button className="btn-primary" onClick={() => open({ kind: 'vehicle' })}><Plus size={16} /> Add vehicle</button>
      </div>
      {state.vehicles.length === 0 && (
        <Empty>
          You have not added a vehicle yet. Add your car or motorcycle and it will show here.
        </Empty>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.vehicles.map((v) => {
          const active = v.id === state.activeVehicleId
          const Icon = v.type === 'car' ? Car : Bike
          return (
            <article key={v.id} className={`card p-4 ${active ? 'ring-2 ring-orange-500' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-500"><Icon size={22} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-bold">{v.nickname}</h3>
                  <p className="break-words text-xs text-slate-500">{v.year} {v.make} {v.model} · {v.plate || 'No plate'}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {num(v.odometer)} km · {v.fuelType} · ~{v.avgDailyKm} km/day · Coding: {v.codingDay}
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1" disabled={active} onClick={() => setActive(v.id)}>{active ? 'Active' : 'Switch'}</button>
                <button className="btn-ghost w-11 !px-0" aria-label="Edit" onClick={() => open({ kind: 'vehicle', item: v })}><Pencil size={16} /></button>
                <button className="btn-ghost w-11 !px-0" aria-label={`Set up maintenance for ${v.nickname}`} title="Set up maintenance" onClick={() => open({ kind: 'setup', vehicleId: v.id })}><Wrench size={16} /></button>
                <button className="btn-danger w-11 !px-0" aria-label="Delete"
                  onClick={() => { if (confirm(`Delete ${v.nickname} and all its logs?`)) deleteVehicle(v.id) }}><Trash2 size={16} /></button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
