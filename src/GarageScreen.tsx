import { useMemo } from 'react'
import { CalendarClock, Check, CheckCircle2, ChevronRight, Fuel, Gauge, MapPin, Plus, ShieldAlert, ShieldCheck, ShieldQuestion, Wrench } from 'lucide-react'
import { useStore } from './store'
import { Empty, Pill, Progress } from './ui'
import type { ModalState } from './modals'
import type { Page, Vehicle } from './types'
import {
  buildLedger, codingStatus, fuelEfficiency, loggedKmSpan, maintHealth, num, overallHealth, spendSummary, todayISO,
  type Health, type OverallHealth, type OverallLevel,
} from './logic'
import { MONTH_NAMES, nextRenewal, reminderLevel } from './plate'

type Open = (m: ModalState) => void
const TONE = { Healthy: 'ok', 'Due Soon': 'soon', Overdue: 'over' } as const
const BAR = { Healthy: 'var(--ok)', 'Due Soon': 'var(--soon)', Overdue: 'var(--over)' } as const

/**
 * A slim row for a fact that is usually fine. Quiet by default (neutral icon, secondary text) and only takes a status
 * colour when something needs doing, so a calm screen stays calm and a coloured one means something.
 */
function StatusLine({ icon: Icon, tone = 'neutral', title, detail, action }: {
  icon: typeof Gauge; tone?: 'neutral' | 'ok' | 'soon' | 'over'; title: string; detail?: string; action?: { label: string; run: () => void }
}) {
  const color = tone === 'neutral' ? 'var(--text-2)' : `var(--${tone})`
  return (
    <li className="row" style={tone === 'soon' || tone === 'over' ? { background: `var(--${tone}-bg)` } : undefined}>
      <Icon size={18} className="shrink-0" style={{ color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug" style={tone === 'soon' || tone === 'over' ? { color } : undefined}>{title}</p>
        {detail && <p className="text-[13px] leading-snug" style={{ color: tone === 'soon' || tone === 'over' ? color : 'var(--text-2)', opacity: tone === 'soon' || tone === 'over' ? 0.85 : 1 }}>{detail}</p>}
      </div>
      {action && <button className="min-h-11 shrink-0 px-1 text-[15px] font-medium" style={{ color: tone === 'soon' || tone === 'over' ? color : 'var(--brand)' }} onClick={action.run}>{action.label}</button>}
    </li>
  )
}

function codingLine(v: Vehicle) {
  const c = codingStatus(v)
  if (c.state === 'coding') return { icon: ShieldAlert, tone: 'over' as const, title: `Coding today (${c.today})`, detail: c.note }
  if (c.state === 'exempt') return { icon: ShieldQuestion, tone: 'neutral' as const, title: 'Exempt from number coding', detail: c.note }
  return { icon: ShieldCheck, tone: 'neutral' as const, title: c.label, detail: c.note }
}

function registrationLine(v: Vehicle, open: Open, save: (v: Vehicle) => void) {
  const r = nextRenewal(v.plate, v.type, todayISO(), v.registeredFor)
  if (!r) {
    return { icon: CalendarClock, tone: 'neutral' as const, title: 'Registration', detail: 'Add a plate number to see this vehicle’s registration month.', action: { label: 'Add plate', run: () => open({ kind: 'vehicle', item: v }) } }
  }
  const level = reminderLevel(r)
  const monthYear = `${MONTH_NAMES[r.month - 1]} ${r.deadline.slice(0, 4)}`
  const mark = () => save({ ...v, registeredFor: r.deadline })
  if (level === 'none') return { icon: CheckCircle2, tone: 'ok' as const, title: `Registered for ${monthYear}`, detail: 'The reminder comes back after that.', action: { label: 'Undo', run: () => save({ ...v, registeredFor: undefined }) } }
  if (level === 'info') return { icon: CalendarClock, tone: 'neutral' as const, title: `Registration due by end of ${monthYear}`, detail: `In ${r.daysLeft} days, estimated from plate ${v.plate}.`, action: { label: 'Registered', run: mark } }
  const title = level === 'overdue' ? `Registration was due ${MONTH_NAMES[r.month - 1]}` : r.daysLeft === 0 ? 'Registration is due today' : `Registration due in ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}`
  return { icon: CalendarClock, tone: level === 'overdue' ? ('over' as const) : ('soon' as const), title, detail: `Estimated from plate ${v.plate}. Confirm the exact dates with LTO.`, action: { label: 'Mark registered', run: mark } }
}

const LEVEL: Record<OverallLevel, { label: string; tone: 'ok' | 'soon' | 'over' | 'check'; blurb: string }> = {
  excellent: { label: 'Excellent', tone: 'ok', blurb: 'Everything is within its service interval.' },
  good: { label: 'Good', tone: 'ok', blurb: 'In good shape, with something coming up soon.' },
  fair: { label: 'Needs attention', tone: 'soon', blurb: 'Some items need servicing.' },
  poor: { label: 'Needs service', tone: 'over', blurb: 'Several items are overdue. Service soon.' },
  unchecked: { label: 'Let’s check it', tone: 'check', blurb: 'We do not know when things were last done yet. Tell us what you remember and we will work out what is due.' },
  none: { label: 'No data', tone: 'check', blurb: 'Add maintenance items to track this vehicle.' },
}

/** Overall vehicle health: a ring with the score, a plain-language label, the counts, and what to fix first. */
export function OverallHealthCard({ o, vehicleName }: { o: OverallHealth; vehicleName: string }) {
  const st = LEVEL[o.level]
  const R = 42, C = 2 * Math.PI * R
  const stroke = st.tone === 'check' ? 'var(--text-3)' : `var(--${st.tone})`
  return (
    <div className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center" role="group" aria-label={`Overall health of ${vehicleName}`}>
      <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0" aria-hidden>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" stroke="var(--hairline)" />
          {o.score !== null && (
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" strokeLinecap="round" stroke={stroke} className="transition-all duration-700"
              strokeDasharray={C} strokeDashoffset={C * (1 - o.score / 100)} />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="num text-[30px] font-bold leading-none tracking-tight">{o.score ?? '—'}</p>
            {o.score !== null && <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>of 100</p>}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>Overall health</p>
        <p className="text-[22px] font-bold leading-tight tracking-tight" style={{ color: st.tone === 'check' ? 'var(--text)' : `var(--${st.tone})` }}>
          {o.score !== null && <span className="sr-only">{o.score} out of 100. </span>}{st.label}
        </p>
        <p className="mt-0.5 text-[15px]" style={{ color: 'var(--text-2)' }}>{st.blurb}</p>
        {o.total > 0 && (
          <ul className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start" aria-label="Items by status">
            {o.healthy > 0 && <li><Pill tone="ok">{o.healthy} healthy</Pill></li>}
            {o.dueSoon > 0 && <li><Pill tone="soon">{o.dueSoon} due soon</Pill></li>}
            {o.overdue > 0 && <li><Pill tone="over">{o.overdue} overdue</Pill></li>}
            {o.unknown > 0 && <li><Pill tone="check">{o.unknown} to check</Pill></li>}
          </ul>
        )}
        {o.unknown > 0 && (
          <p className="mt-3 p-3 text-[13px] leading-snug" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderRadius: 'var(--r-ctl)' }}>
            {o.unknown === o.total
              ? 'You have not told us when anything was last done. Tap an item and mark it serviced, or set its date, and the score appears.'
              : `${o.unknown} of ${o.total} items still need a date, so they are left out of the score for now. Confirm them and the score gets more accurate.`}
          </p>
        )}
      </div>
    </div>
  )
}

/** The one thing most worth doing next, with how far away it is as the large number. */
function NextDue({ item, h, onOpen }: { item: { name: string }; h: Health; onOpen: () => void }) {
  const over = h.status === 'Overdue'
  const km = h.kmRemaining, days = h.daysRemaining
  const primary = km !== undefined && (days === undefined || km <= (days ?? Infinity) * 1000) ? km : undefined
  const big = primary !== undefined ? `${num(Math.abs(primary))} km` : days !== undefined ? `${Math.abs(days)} days` : '—'
  const sub = primary !== undefined ? (primary < 0 ? 'past due' : 'remaining') : days !== undefined ? (days < 0 ? 'past due' : 'remaining') : ''
  return (
    <button onClick={onOpen} className="card flex w-full items-center gap-4 p-5 text-left transition active:scale-[0.99]">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>{over ? 'Needs service' : 'Next due'}</p>
        <p className="mt-0.5 break-words text-[17px] font-semibold leading-snug">{item.name}</p>
        <Pill tone={TONE[h.status]}>{h.status}</Pill>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-[28px] font-bold leading-none tracking-tight" style={{ color: over ? 'var(--over)' : undefined }}>{big}</p>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>{sub}</p>
      </div>
      <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
    </button>
  )
}

export function GaragePage({ open, go }: { open: Open; go: (p: Page) => void }) {
  const { state, vehicle, saveVehicle } = useStore()
  const data = useMemo(() => {
    if (!vehicle) return null
    const rows = buildLedger(state.fuel, state.expenses, vehicle.id)
    const eff = fuelEfficiency(state.fuel.filter((f) => f.vehicleId === vehicle.id))
    const sum = spendSummary(rows, loggedKmSpan(state.fuel, state.expenses, vehicle.id))
    const items = state.maint.filter((m) => m.vehicleId === vehicle.id)
      .map((m) => ({ m, h: maintHealth(m, vehicle) }))
      // most urgent first; items whose last service is unknown are shown after the ones we can actually judge
      .sort((a, b) => Number(!!a.m.unknownLast) - Number(!!b.m.unknownLast) || b.h.pct - a.h.pct)
    return { eff, sum, items, overall: overallHealth(items.map(({ m, h }) => ({ name: m.name, h, unknown: m.unknownLast }))) }
  }, [state, vehicle])

  if (!vehicle || !data) return <Empty>No vehicles yet. Add one from More → Vehicles.</Empty>

  const coding = codingLine(vehicle)
  const reg = registrationLine(vehicle, open, saveVehicle)
  const next = data.items.find((i) => !i.m.unknownLast && i.h.status !== 'Healthy') ?? data.items.find((i) => !i.m.unknownLast)

  return (
    <div className="page space-y-6">
      <ul className="group-list" aria-label="Vehicle status">
        <StatusLine {...coding} />
        <StatusLine {...reg} />
        <li className="row !p-0">
          <button onClick={() => go('fuelwatch')} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]">
            <MapPin size={18} className="shrink-0" style={{ color: 'var(--text-2)' }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium leading-snug">Fuel Watch</span>
              <span className="block text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>Compare pump prices, or see the price near you</span>
            </span>
            <ChevronRight size={16} style={{ color: 'var(--text-3)' }} aria-hidden />
          </button>
        </li>
      </ul>

      {next && <NextDue item={next.m} h={next.h} onOpen={() => open({ kind: 'item', item: next.m })} />}

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--text-2)' }}><Gauge size={14} aria-hidden /> Odometer</p>
          <p className="num mt-1 text-[22px] font-bold leading-tight tracking-tight">{num(vehicle.odometer)} <span className="text-[15px] font-medium" style={{ color: 'var(--text-2)' }}>km</span></p>
          <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>about {vehicle.avgDailyKm} km a day</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--text-2)' }}><Fuel size={14} aria-hidden /> Efficiency</p>
          <p className="num mt-1 text-[22px] font-bold leading-tight tracking-tight">{data.eff.avg ? data.eff.avg.toFixed(1) : '—'} <span className="text-[15px] font-medium" style={{ color: 'var(--text-2)' }}>{data.eff.avg ? 'km/L' : ''}</span></p>
          <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{data.eff.last ? `last fill ${data.eff.last.toFixed(1)} km/L` : 'log 2 full tanks'}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="px-1 text-[22px] font-bold tracking-tight">Maintenance</h2>
        <OverallHealthCard o={data.overall} vehicleName={vehicle.nickname} />

        {data.items.length === 0 ? (
          <Empty>
            Nothing is being tracked for this vehicle yet.
            <div className="mt-3"><button className="btn-primary" onClick={() => open({ kind: 'setup', vehicleId: vehicle.id })}><Wrench size={16} /> Set up maintenance</button></div>
          </Empty>
        ) : (
          <>
            <ul className="group-list" aria-label="Service items">
              {data.items.map(({ m, h }) => {
                const interval = [m.intervalKm && `${num(m.intervalKm)} km`, m.intervalMonths && `${m.intervalMonths} mo`].filter(Boolean).join(' or ')
                const right = m.unknownLast ? null : h.kmRemaining !== undefined ? `${h.kmRemaining < 0 ? '+' : ''}${num(Math.abs(h.kmRemaining))} km` : h.daysRemaining !== undefined ? `${Math.abs(h.daysRemaining)} d` : '—'
                return (
                  <li key={m.id} className="row !p-0">
                    <button onClick={() => open({ kind: 'item', item: m })} className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]">
                      <span className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-[15px] font-medium leading-snug">{m.name}</span>
                          <span className="block text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
                            Every {interval}{m.unknownLast ? ' · last service unknown' : m.neverDone ? ' · never done yet' : ''}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {m.unknownLast ? <Pill tone="check">Check</Pill> : <Pill tone={TONE[h.status]}>{h.status}</Pill>}
                          {right && <span className="num text-[13px] font-medium" style={{ color: h.kmRemaining !== undefined && h.kmRemaining < 0 ? 'var(--over)' : 'var(--text-2)' }}>{h.kmRemaining !== undefined && h.kmRemaining < 0 ? `${right} over` : right}</span>}
                        </span>
                        <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
                      </span>
                      {!m.unknownLast && <Progress pct={h.pct} className="" />}
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex justify-center">
              <button className="btn-ghost" onClick={() => open({ kind: 'maint' })}><Plus size={16} /> Add an item</button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

// Re-exported so existing imports keep working; the status colours the bars use.
export { BAR as STATUS_BAR, Check }
