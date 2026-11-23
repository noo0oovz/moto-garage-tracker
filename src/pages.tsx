import { useMemo, useRef, useState } from 'react'
import {
  AlarmClockCheck, CalendarClock, Check, CheckCircle2, ChevronRight, Download, Fuel, Gauge, Pencil, Plus, RotateCcw, Trash2,
  Upload, Wallet, Wrench, FileSpreadsheet, Cog, MapPin, ShieldAlert, ShieldCheck, ShieldQuestion, Car, Bike, TrendingUp,
} from 'lucide-react'
import { useStore } from './store'
import { Empty, Progress } from './ui'
import type { ModalState } from './modals'
import type { Page, Vehicle } from './types'
import {
  backupStatus, buildLedger, codingStatus, csvEscape, fmtDate, fuelEfficiency, loggedKmSpan, maintHealth, num, overallHealth, peso, spendSummary, statusColor, todayISO,
  type OverallHealth, type OverallLevel,
} from './logic'
import { CHECKLIST_CAR, CHECKLIST_MOTO } from './data'
import { useMinWidth } from './useLayout'
import { MONTH_NAMES, nextRenewal, reminderLevel } from './plate'

type Open = (m: ModalState) => void

export function CodingBanner({ v, compact = false }: { v: Vehicle; compact?: boolean }) {
  const c = codingStatus(v)
  const tone = c.state === 'coding' ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300'
    : c.state === 'exempt' ? 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300'
    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
  const Icon = c.state === 'coding' ? ShieldAlert : c.state === 'exempt' ? ShieldQuestion : ShieldCheck
  if (compact) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${tone}`}>
        <Icon size={16} className="shrink-0" /> <span className="min-w-0 break-words">{c.label}</span>
      </div>
    )
  }
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-3 ${tone}`}>
      <Icon size={22} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold">UVVRP · {c.label}</p>
        <p className="text-xs opacity-80">{c.note}</p>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Gauge; label: string; value: string; sub?: string }) {
  return (
    <div className="card min-w-[70%] shrink-0 snap-start p-4 md:min-w-0">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-500/15 text-orange-500"><Icon size={16} /></span>
        {label}
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  )
}

const LEVEL_STYLE: Record<OverallLevel, { label: string; ring: string; text: string; blurb: string }> = {
  excellent: { label: 'Excellent', ring: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', blurb: 'Everything is within its service interval.' },
  good: { label: 'Good', ring: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', blurb: 'In good shape, with something coming up soon.' },
  fair: { label: 'Needs attention', ring: 'stroke-amber-500', text: 'text-amber-600 dark:text-amber-400', blurb: 'Some items need servicing.' },
  poor: { label: 'Needs service', ring: 'stroke-red-500', text: 'text-red-600 dark:text-red-400', blurb: 'Several items are overdue. Service soon.' },
  none: { label: 'No data', ring: 'stroke-slate-400', text: 'text-slate-500', blurb: 'Add maintenance items to track this vehicle.' },
}

/** Overall vehicle health: a ring with the score, a plain-language label, the counts, and what to fix first. */
export function OverallHealthCard({ o, vehicleName }: { o: OverallHealth; vehicleName: string }) {
  const st = LEVEL_STYLE[o.level]
  const R = 42, C = 2 * Math.PI * R
  const score = o.score ?? 0
  return (
    <div className="card mb-3 flex flex-col gap-4 p-4 sm:flex-row sm:items-center" role="group" aria-label={`Overall health of ${vehicleName}`}>
      <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0" aria-hidden>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-slate-200 dark:stroke-white/10" />
          {o.score !== null && (
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round" className={`${st.ring} transition-all duration-700`}
              strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-3xl font-extrabold leading-none tabular-nums">{o.score ?? '—'}</p>
            {o.score !== null && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">of 100</p>}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Overall health</p>
        <p className={`text-xl font-extrabold ${st.text}`}>
          {o.score !== null && <span className="sr-only">{o.score} out of 100. </span>}{st.label}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{st.blurb}</p>
        {o.total > 0 && (
          <ul className="mt-2 flex flex-wrap justify-center gap-1.5 text-xs font-semibold sm:justify-start" aria-label="Items by status">
            <li className={`rounded-full px-2.5 py-1 ${statusColor.Healthy.badge}`}>{o.healthy} healthy</li>
            {o.dueSoon > 0 && <li className={`rounded-full px-2.5 py-1 ${statusColor['Due Soon'].badge}`}>{o.dueSoon} due soon</li>}
            {o.overdue > 0 && <li className={`rounded-full px-2.5 py-1 ${statusColor.Overdue.badge}`}>{o.overdue} overdue</li>}
          </ul>
        )}
        {o.worst && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {o.worst.status === 'Overdue' ? 'Most overdue' : 'Next up'}: <b className="text-slate-700 dark:text-slate-200">{o.worst.name}</b>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Estimated registration status from the plate. It always shows something: a far-off deadline is a quiet line (not
 * nothing, which looks like a missing feature), a near or missed one is an amber/red banner, and a deadline the user
 * marked as done turns into a calm "Registered" line until the next renewal comes round.
 */
export function RegistrationBanner({ v, open }: { v: Vehicle; open: Open }) {
  const { saveVehicle } = useStore()
  const r = nextRenewal(v.plate, v.type, todayISO(), v.registeredFor)
  if (!r) {
    return (
      <button onClick={() => open({ kind: 'vehicle', item: v })} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-left text-xs text-slate-500 hover:bg-slate-100 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5">
        <CalendarClock size={16} className="shrink-0" /> Add a plate number to see this vehicle&rsquo;s registration month.
      </button>
    )
  }
  const level = reminderLevel(r)
  const monthYear = `${MONTH_NAMES[r.month - 1]} ${r.deadline.slice(0, 4)}`
  const mark = () => saveVehicle({ ...v, registeredFor: r.deadline })
  const undo = () => saveVehicle({ ...v, registeredFor: undefined })

  if (level === 'none') {
    return (
      <div role="status" className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={16} className="shrink-0" />
        <span className="min-w-0 flex-1">Registered for {monthYear}. Next renewal reminder comes back after that.</span>
        <button className="min-h-11 shrink-0 px-2 font-semibold underline" onClick={undo}>Undo</button>
      </div>
    )
  }
  if (level === 'info') {
    return (
      <div role="status" className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
        <CalendarClock size={16} className="shrink-0" />
        <span className="min-w-0 flex-1">Registration due by the end of <b>{monthYear}</b> (in {r.daysLeft} days). Estimated from plate {v.plate}.</span>
        <button className="min-h-11 shrink-0 px-2 font-semibold text-orange-500 underline" onClick={mark}>Already registered</button>
      </div>
    )
  }
  const tone = level === 'overdue' ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return (
    <div role="status" className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${tone}`}>
      <CalendarClock size={22} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {level === 'overdue' ? `Registration was due ${MONTH_NAMES[r.month - 1]}` : r.daysLeft === 0 ? 'Registration is due today' : `Registration due in ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}`}
        </p>
        <p className="text-xs opacity-80">Estimated from plate {v.plate}: renew by the end of {MONTH_NAMES[r.month - 1]}. Confirm exact dates with LTO.</p>
      </div>
      <button className="btn-ghost shrink-0 !border-current !text-current" onClick={mark}><Check size={16} /> Mark as registered</button>
    </div>
  )
}

export function GaragePage({ open, go }: { open: Open; go: (p: Page) => void }) {
  const { state, vehicle } = useStore()
  const data = useMemo(() => {
    if (!vehicle) return null
    const rows = buildLedger(state.fuel, state.expenses, vehicle.id)
    const eff = fuelEfficiency(state.fuel.filter((f) => f.vehicleId === vehicle.id))
    const sum = spendSummary(rows, loggedKmSpan(state.fuel, state.expenses, vehicle.id))
    const items = state.maint.filter((m) => m.vehicleId === vehicle.id)
      .map((m) => ({ m, h: maintHealth(m, vehicle) }))
      .sort((a, b) => b.h.pct - a.h.pct)
    return { eff, sum, items, overall: overallHealth(items.map(({ m, h }) => ({ name: m.name, h }))) }
  }, [state, vehicle])

  if (!vehicle || !data) return <Empty>No vehicles yet. Add one from More → Vehicles.</Empty>
  const attention = data.items.filter((i) => i.h.status !== 'Healthy').length

  return (
    <div className="page space-y-5">
      <CodingBanner v={vehicle} />
      <RegistrationBanner v={vehicle} open={open} />
      <button onClick={() => go('fuelwatch')} className="card flex min-h-14 w-full items-center gap-3 p-3 text-left transition hover:border-orange-500/50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-500"><MapPin size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Fuel Watch</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Compare Petron, Shell, Caltex &amp; more, or estimate the price near you</span>
        </span>
        <ChevronRight size={16} className="text-slate-400" />
      </button>

      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4">
        <Kpi icon={Gauge} label="Odometer" value={`${num(vehicle.odometer)} km`} sub={`~${vehicle.avgDailyKm} km/day`} />
        <Kpi icon={Wallet} label="Spent this month" value={peso(data.sum.thisMonth)} sub={`All time ${peso(data.sum.all)}`} />
        <Kpi icon={Fuel} label="Avg efficiency" value={data.eff.avg ? `${data.eff.avg.toFixed(1)} km/L` : '—'}
          sub={data.eff.last ? `Last fill ${data.eff.last.toFixed(1)} km/L` : 'Log 2+ full tanks'} />
        <Kpi icon={attention ? ShieldAlert : TrendingUp} label="Maintenance"
          value={attention ? `${attention} ${attention === 1 ? 'item needs' : 'items need'} attention` : 'All healthy'}
          sub={data.sum.perKm ? `Cost per km ${peso(data.sum.perKm, 2)}` : 'Cost per km —'} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Maintenance Health</h2>
          <button className="btn-ghost !min-h-11" onClick={() => open({ kind: 'maint' })}><Plus size={16} /> Add item</button>
        </div>
        <OverallHealthCard o={data.overall} vehicleName={vehicle.nickname} />
        {data.items.length === 0 ? <Empty>No maintenance items yet.</Empty> : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {data.items.map(({ m, h }) => (
              <article key={m.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm font-bold leading-snug">{m.name}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[h.status].badge}`}>{h.status}</span>
                </div>
                <Progress pct={h.pct} className={statusColor[h.status].bar} />
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Km remaining</dt>
                    <dd className={`text-sm font-semibold ${h.kmRemaining !== undefined && h.kmRemaining < 0 ? 'text-red-500' : ''}`}>
                      {h.kmRemaining === undefined ? '—' : h.kmRemaining < 0 ? `${num(-h.kmRemaining)} km over` : `${num(h.kmRemaining)} km`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Est. days left</dt>
                    <dd className={`text-sm font-semibold ${h.daysRemaining !== undefined && h.daysRemaining < 0 ? 'text-red-500' : ''}`}>
                      {h.daysRemaining === undefined ? '—' : h.daysRemaining < 0 ? `${-h.daysRemaining} days over` : `~${h.daysRemaining} days`}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every {[m.intervalKm && `${num(m.intervalKm)} km`, m.intervalMonths && `${m.intervalMonths} mo`].filter(Boolean).join(' / ')}
                  {' · last '}{num(m.lastServiceKm)} km, {fmtDate(m.lastServiceDate)}
                </p>
                <div className="mt-auto flex gap-2">
                  <button className="btn-primary flex-1" onClick={() => open({ kind: 'service', item: m })}><Check size={16} /> Mark Serviced</button>
                  <button className="btn-ghost w-11 !px-0" aria-label="Edit" onClick={() => open({ kind: 'maint', item: m })}><Pencil size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
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
    <span className="grid h-11 w-11 place-items-center text-slate-300 dark:text-white/20" title="Edit this from Service History or Parts"><Pencil size={16} /></span>
  ) : (
    <button aria-label="Edit" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:text-orange-500" onClick={() => edit(r)}><Pencil size={16} /></button>
  )

  return (
    <div className="page space-y-5">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${r.kind === 'fuel' ? 'bg-sky-500/15 text-sky-500' : 'bg-orange-500/15 text-orange-500'}`}>
                    {r.kind === 'fuel' ? <Fuel size={18} /> : <Wrench size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold">{r.category}{r.place ? ` · ${r.place}` : ''}</p>
                    <p className="break-words text-xs text-slate-500 dark:text-slate-400">
                      {fmtDate(r.date)}{r.odometer ? ` · ${num(r.odometer)} km` : ''}{r.kmPerL ? ` · ${r.kmPerL.toFixed(1)} km/L` : ''}
                    </p>
                    {r.desc && <p className="break-words text-xs text-slate-500 dark:text-slate-400">{r.desc}</p>}
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
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5">
                  <tr>{['Date', 'Category', 'Shop / Station', 'Details', 'Odometer', 'km/L', 'Cost', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {visible.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Showing {limit} of {shown.length} entries</p>
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
          <p className="text-xs text-slate-500 dark:text-slate-400">{done}/{list.length} checked · {vehicle.nickname}</p>
          <div className="mt-2"><Progress pct={(done / list.length) * 100} className={done === list.length ? 'bg-emerald-500' : 'bg-orange-500'} /></div>
        </div>
        <button className="btn-ghost" onClick={() => resetChecklist(vehicle.id)}><RotateCcw size={16} /> Reset</button>
      </div>
      {done === list.length && <div className="anim-pop rounded-2xl bg-emerald-500/15 p-3 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">All clear — ride safe! 🏁</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="card p-2">
            <h3 className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{g.title}</h3>
            <ul>
              {g.items.map((i) => {
                const on = checked.includes(i.key)
                return (
                  <li key={i.key}>
                    <button onClick={() => toggleCheck(vehicle.id, i.key)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/5" aria-pressed={on}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-white/25'}`}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${on ? 'text-slate-400 line-through' : ''}`}>{i.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{i.hint}</span>
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
                  <p className="break-words text-xs text-slate-500 dark:text-slate-400">{v.year} {v.make} {v.model} · {v.plate || 'No plate'}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {num(v.odometer)} km · {v.fuelType} · ~{v.avgDailyKm} km/day · Coding: {v.codingDay}
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1" disabled={active} onClick={() => setActive(v.id)}>{active ? 'Active' : 'Switch'}</button>
                <button className="btn-ghost w-11 !px-0" aria-label="Edit" onClick={() => open({ kind: 'vehicle', item: v })}><Pencil size={16} /></button>
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

export function SettingsPage() {
  const { state, importState, resetDemo, toggleTheme, markBackedUp } = useStore()
  const backup = backupStatus(state)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  const stamp = new Date().toISOString().slice(0, 10)

  const exportCsv = () => {
    const head = ['Vehicle', 'Date', 'Type', 'Category', 'Shop/Station', 'Details', 'Odometer', 'Liters', 'PricePerLiter', 'FullTank', 'Cost']
    const name = (id: string) => state.vehicles.find((v) => v.id === id)?.nickname ?? ''
    const lines = [
      ...state.fuel.map((f) => [name(f.vehicleId), f.date, 'Fuel', 'Fuel', f.station, '', f.odometer, f.liters, f.pricePerLiter, f.fullTank, f.totalCost]),
      ...state.expenses.map((e) => [name(e.vehicleId), e.date, 'Expense', e.category, e.shopName, e.notes, e.odometer ?? '', '', '', '', e.cost]),
    ].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
    download(`motogarage-logs-${stamp}.csv`, [head, ...lines].map((r) => r.map(csvEscape).join(',')).join('\n'), 'text/csv')
  }

  const onFile = async (f?: File) => {
    if (!f) return
    const ok = importState(await f.text())
    setMsg(ok ? 'Backup imported successfully.' : 'Import failed: not a valid MotoGarage backup.')
    if (fileRef.current) fileRef.current.value = ''
  }

  const Row = ({ icon: Icon, title, sub, onClick, danger }: { icon: typeof Download; title: string; sub: string; onClick: () => void; danger?: boolean }) => (
    <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${danger ? 'bg-red-500/15 text-red-500' : 'bg-orange-500/15 text-orange-500'}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{sub}</span></span>
      <ChevronRight size={16} className="text-slate-400" />
    </button>
  )

  return (
    <div className="page mx-auto max-w-2xl space-y-4">
      <section className="card p-2">
        <h2 className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">Appearance</h2>
        <Row icon={AlarmClockCheck} title="Toggle theme" sub={`Currently ${state.theme} mode`} onClick={toggleTheme} />
      </section>
      <section className="card p-2">
        <h2 className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">Data &amp; Backup</h2>
        <Row icon={Download} title="Export JSON Backup"
          sub={backup.never ? 'Never backed up — everything lives only in this browser' : `Last backup ${backup.days === 0 ? 'today' : `${backup.days} day${backup.days === 1 ? '' : 's'} ago`}`}
          onClick={() => { download(`motogarage-backup-${stamp}.json`, JSON.stringify({ ...state, lastBackupAt: new Date().toISOString() }, null, 2), 'application/json'); markBackedUp() }} />
        <Row icon={Upload} title="Import JSON Backup" sub="Replaces current data" onClick={() => fileRef.current?.click()} />
        <Row icon={FileSpreadsheet} title="Export Logs to CSV" sub="Fuel & expenses for spreadsheets" onClick={exportCsv} />
        <Row icon={RotateCcw} danger title="Reset Demo Data" sub="Erase everything and restore the sample garage"
          onClick={() => { if (confirm('Reset all data to the demo garage? This cannot be undone.')) { resetDemo(); setMsg('Demo data restored.') } }} />
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {msg && <p role="status" className="px-3 pb-3 text-sm text-orange-500">{msg}</p>}
      </section>
      <p className="px-2 text-center text-xs text-slate-500">MotoGarage PH · data lives only in this browser (schema v{state.version}). Export backups regularly.</p>
    </div>
  )
}

export function MorePage({ go }: { go: (p: Page) => void }) {
  const items: { p: Page; icon: typeof Car; title: string; sub: string }[] = [
    { p: 'fuelwatch', icon: Gauge, title: 'Fuel Watch', sub: 'PH pump prices by brand, near you' },
    { p: 'fuel', icon: Fuel, title: 'Fuel Logs', sub: 'Fill-ups, litres and km/L' },
    { p: 'history', icon: Wrench, title: 'Service History', sub: 'Timeline of every service' },
    { p: 'parts', icon: Cog, title: 'Parts & Accessories', sub: 'Part records and warranties' },
    { p: 'vehicles', icon: Car, title: 'Vehicles', sub: 'Add, edit, switch or delete' },
    { p: 'settings', icon: CalendarClock, title: 'Settings & Backup', sub: 'Theme, export, import, reset' },
  ]
  return (
    <div className="page card p-2">
      {items.map((i) => (
        <button key={i.p} onClick={() => go(i.p)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/15 text-orange-500"><i.icon size={18} /></span>
          <span className="flex-1"><span className="block text-sm font-semibold">{i.title}</span><span className="block text-xs text-slate-500">{i.sub}</span></span>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      ))}
    </div>
  )
}
