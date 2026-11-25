import { useMemo, useState } from 'react'
import { Check, Fuel, Pencil, Plus, RotateCcw, Trash2, Wrench } from 'lucide-react'
import { artKind } from './VehicleArt'
import { VehicleLine } from './VehicleLine'
import { FramedPhoto } from './FramedPhoto'
import { subtitle } from './VehicleHero'
import { useStore } from './store'
import { Empty, ListCard, PageHeader, Pill, Stat } from './ui'
import type { ModalState } from './modals'
import { buildLedger, fmtDate, loggedKmSpan, maintHealth, num, overallHealth, peso, spendSummary } from './logic'
import { CHECKLIST_CAR, CHECKLIST_MOTO } from './data'
import { useMinWidth } from './useLayout'

type Open = (m: ModalState) => void

/** A quiet icon button: muted until it is hovered or focused, and always a full 44px target. */
export function IconBtn({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-[var(--surface-2)] active:opacity-60" style={{ color: danger ? 'var(--over)' : 'var(--text-3)' }}>
      {children}
    </button>
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
    <span className="grid h-11 w-11 shrink-0 place-items-center opacity-40" style={{ color: 'var(--text-3)' }} title="Edit this from Service History or Parts"><Pencil size={16} /></span>
  ) : (
    <IconBtn label="Edit" onClick={() => edit(r)}><Pencil size={16} /></IconBtn>
  )

  return (
    <div className="page space-y-5">
      <PageHeader title="Logs" sub={`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`} />

      {/* the numbers that matter, in one card */}
      <section className="card grid grid-cols-2 gap-x-4 gap-y-4 p-4 lg:grid-cols-4" aria-label="Spending summary">
        <Stat label="This month" value={peso(sum.thisMonth)} />
        <Stat label="All time" value={peso(sum.all)} />
        <Stat label="Cost per km" value={sum.perKm ? peso(sum.perKm, 2) : '—'} sub="per km logged" />
        <Stat label="Entries" value={String(rows.length)} />
      </section>

      <section className="space-y-2" aria-label="Spend by category">
        <h3 className="px-1 text-[13px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>Spend by category</h3>
        {Object.keys(sum.byCat).length === 0 ? <Empty>Nothing logged yet.</Empty> : (
          <ListCard>
            {Object.entries(sum.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
              <li key={c} className="px-4 py-3" style={{ borderColor: 'var(--hairline)' }}>
                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="min-w-0 break-words">{c}</span>
                  <span className="num shrink-0"><span className="font-medium">{peso(v)}</span> <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{sum.all > 0 ? Math.round((v / sum.all) * 100) : 0}%</span></span>
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--hairline)' }} role="presentation">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: 'var(--text-3)' }} />
                </div>
              </li>
            ))}
          </ListCard>
        )}
      </section>

      <section className="space-y-3">
        <PageHeader title="Ledger" sectionTitle />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field sm:w-64" placeholder="Search…" aria-label="Search the ledger" value={q} onChange={(e) => { setQ(e.target.value); setLimit(100) }} />
          <select className="field sm:w-56" aria-label="Filter by category" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(100) }}>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {shown.length === 0 ? <Empty>No entries match.</Empty> : (
          <>
            {!wide && (
              <ListCard label="Ledger entries">
                {visible.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2 pl-4 pr-1" style={{ borderColor: 'var(--hairline)' }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }} aria-hidden>
                      {r.kind === 'fuel' ? <Fuel size={16} /> : <Wrench size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{r.category}{r.place ? ` · ${r.place}` : ''}</p>
                      <p className="num break-words text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
                        {fmtDate(r.date)}{r.odometer ? ` · ${num(r.odometer)} km` : ''}{r.kmPerL ? ` · ${r.kmPerL.toFixed(1)} km/L` : ''}
                      </p>
                      {r.desc && <p className="text-[13px] leading-snug [overflow-wrap:anywhere]" style={{ color: 'var(--text-2)' }}>{r.desc}</p>}
                    </div>
                    <span className="num shrink-0 text-[15px] font-semibold">{peso(r.cost, 2)}</span>
                    <div className="flex shrink-0">
                      <EditBtn r={r} />
                      <IconBtn label="Delete" onClick={() => del(r)}><Trash2 size={16} /></IconBtn>
                    </div>
                  </li>
                ))}
              </ListCard>
            )}
            {wide && (
              <div className="card overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-2)', borderBottom: '1px solid var(--hairline)' }}>
                    <tr>{[['Date', 'w-[9rem]'], ['Category', 'w-[11rem]'], ['Shop / Station', 'w-[12rem]'], ['Details', ''], ['Odometer', 'w-[8rem]'], ['km/L', 'w-[5rem]'], ['Cost', 'w-[9rem] text-right'], ['', 'w-[7rem]']].map(([h, w]) => <th key={h || 'actions'} className={`px-4 py-3 font-medium ${w}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
                    {visible.map((r) => (
                      <tr key={r.id} className="hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--hairline)' }}>
                        <td className="num whitespace-nowrap px-4 py-3">{fmtDate(r.date)}</td>
                        <td className="px-4 py-3 [overflow-wrap:anywhere]">{r.category}</td>
                        <td className="px-4 py-3 [overflow-wrap:anywhere]">{r.place || '—'}</td>
                        <td className="px-4 py-3 [overflow-wrap:anywhere]" style={{ color: 'var(--text-2)' }}>{r.desc || '—'}</td>
                        <td className="num px-4 py-3">{r.odometer ? `${num(r.odometer)} km` : '—'}</td>
                        <td className="num px-4 py-3">{r.kmPerL ? r.kmPerL.toFixed(1) : '—'}</td>
                        <td className="num whitespace-nowrap px-4 py-3 text-right font-semibold">{peso(r.cost, 2)}</td>
                        <td className="whitespace-nowrap px-2 py-1"><div className="flex"><EditBtn r={r} /><IconBtn label="Delete" onClick={() => del(r)}><Trash2 size={16} /></IconBtn></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {shown.length > limit && (
              <div className="flex flex-col items-center gap-1 pt-1">
                <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>Showing {limit} of {shown.length} entries</p>
                <button className="btn-ghost" onClick={() => setLimit((l) => l + 200)}>Show 200 more</button>
              </div>
            )}
          </>
        )}
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
  const all = done === list.length
  return (
    <div className="page space-y-5">
      <PageHeader
        title="Pre-trip check"
        sub={`${done} of ${list.length} checked`}
        action={<button className="btn-ghost" onClick={() => resetChecklist(vehicle.id)} disabled={done === 0}><RotateCcw size={16} /> Reset</button>}
      />
      <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--hairline)' }} role="img" aria-label={`${done} of ${list.length} checked`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(done / list.length) * 100}%`, background: all ? 'var(--ok)' : 'var(--text-3)' }} />
      </div>
      {all && <p role="status" className="anim-pop text-center text-[15px] font-medium" style={{ color: 'var(--ok)' }}>All clear. Ride safe.</p>}
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="space-y-2">
            <h3 className="px-1 text-[13px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>{g.title}</h3>
            <ListCard>
              {g.items.map((i) => {
                const on = checked.includes(i.key)
                return (
                  <li key={i.key} style={{ borderColor: 'var(--hairline)' }}>
                    <button onClick={() => toggleCheck(vehicle.id, i.key)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-2)]" aria-pressed={on}>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border transition"
                        style={on ? { background: 'var(--ok)', borderColor: 'var(--ok)', color: 'var(--surface)' } : { borderColor: 'var(--text-3)' }}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium leading-snug" style={on ? { color: 'var(--text-3)', textDecoration: 'line-through' } : undefined}>{i.label}</span>
                        <span className="block text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>{i.hint}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ListCard>
          </section>
        ))}
      </div>
    </div>
  )
}

export function VehiclesPage({ open }: { open: Open }) {
  const { state, setActive, deleteVehicle } = useStore()
  return (
    <div className="page space-y-5">
      <PageHeader title="Vehicles" sub={state.vehicles.length ? `${state.vehicles.length} in your garage` : undefined}
        action={<button className="btn-primary" onClick={() => open({ kind: 'vehicle' })}><Plus size={16} /> Add vehicle</button>} />
      {state.vehicles.length === 0 && (
        <Empty>You have not added a vehicle yet. Add your car or motorcycle and it will show here.</Empty>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.vehicles.map((v) => {
          const active = v.id === state.activeVehicleId
          const items = state.maint.filter((m) => m.vehicleId === v.id)
          const health = overallHealth(items.map((m) => ({ name: m.name, h: maintHealth(m, v), unknown: m.unknownLast })))
          const tone = health.level === 'excellent' || health.level === 'good' ? 'ok' : health.level === 'fair' ? 'soon' : health.level === 'poor' ? 'over' : 'check'
          const healthText = health.score === null ? (items.length ? 'To check' : 'No items yet') : `Health ${health.score}`
          const coding = v.type === 'motorcycle' ? 'No number coding' : v.codingDay === 'Exempt' ? 'Coding exempt' : `Coding ${v.codingDay}`
          return (
            <article key={v.id} className="card flex flex-col overflow-hidden" style={active ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 1px var(--brand)' } : undefined} aria-current={active ? 'true' : undefined}>
              <div className="flex-1 px-4 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-[17px] font-semibold leading-snug">{v.nickname}</h3>
                    <p className="num break-words text-[13px]" style={{ color: 'var(--text-2)' }}>{subtitle(v)}</p>
                  </div>
                  <Pill tone={tone}>{healthText}</Pill>
                </div>
                {v.photo ? (
                  <FramedPhoto src={v.photo} view={v.photoView} alt={`Photo of ${v.nickname}`} className="mt-3" style={{ borderRadius: 'var(--r-ctl)', border: '1px solid var(--hairline)' }} />
                ) : (
                  <div className="mx-auto mt-3 max-w-[220px]" style={{ color: 'var(--text-2)' }}>
                    <VehicleLine kind={artKind(v)} className="block h-auto w-full" />
                  </div>
                )}
                <p className="num mt-3 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  {num(v.odometer)} km · {v.fuelType} · ~{v.avgDailyKm} km/day · {coding}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 px-3 pb-3">
                <button className="btn-ghost flex-1" disabled={active} onClick={() => setActive(v.id)}>{active ? 'Active' : 'Switch'}</button>
                <IconBtn label="Edit" onClick={() => open({ kind: 'vehicle', item: v })}><Pencil size={16} /></IconBtn>
                <IconBtn label={`Set up maintenance for ${v.nickname}`} onClick={() => open({ kind: 'setup', vehicleId: v.id })}><Wrench size={16} /></IconBtn>
                <IconBtn label="Delete" danger onClick={() => { if (confirm(`Delete ${v.nickname} and all its logs?`)) deleteVehicle(v.id) }}><Trash2 size={16} /></IconBtn>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
