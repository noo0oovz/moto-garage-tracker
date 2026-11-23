import { useMemo } from 'react'
import { ChevronRight, Plus, Wrench } from 'lucide-react'
import { useStore } from './store'
import { Empty, Pill } from './ui'
import { IntervalMeter } from './IntervalMeter'
import { PartIcon, type PartTone } from './PartIcon'
import { VehicleHero } from './VehicleHero'
import type { ModalState } from './modals'
import type { MaintItem, Page } from './types'
import { headlineLimit, maintHealth, num, overallHealth, spanLabel, type Health, type OverallHealth, type OverallLevel } from './logic'

type Open = (m: ModalState) => void
const TONE = { Healthy: 'ok', 'Due Soon': 'soon', Overdue: 'over' } as const

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
function NextDue({ item, h, avgDailyKm, onOpen }: { item: MaintItem; h: Health; avgDailyKm: number; onOpen: () => void }) {
  const over = h.status === 'Overdue'
  const lim = headlineLimit(item, h, avgDailyKm)
  // headline the limit that runs out first, in its own units
  const useKm = lim === 'km'
  const value = useKm ? h.kmRemaining : h.daysRemaining
  const big = value === undefined || !Number.isFinite(value) ? '—' : useKm ? `${num(Math.abs(value))} km` : spanLabel(value).replace('about ', '~')
  const sub = value === undefined || !Number.isFinite(value) ? '' : value < 0 ? 'past due' : 'remaining'
  return (
    <button onClick={onOpen} className="card block w-full p-5 text-left transition active:scale-[0.99]" aria-label={`${over ? 'Needs service' : 'Next due'}: ${item.name}`}>
      <div className="flex items-center gap-4">
        <PartIcon item={item} tone={TONE[h.status]} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>{over ? 'Needs service' : 'Next due'}</p>
          <p className="mt-0.5 break-words text-[17px] font-semibold leading-snug">{item.name}</p>
          <div className="mt-1"><Pill tone={TONE[h.status]}>{h.status}</Pill></div>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[28px] font-bold leading-none tracking-tight" style={{ color: over ? 'var(--over)' : undefined }}>{big}</p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>{sub}</p>
        </div>
        <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
      </div>
      <div className="mt-4"><IntervalMeter h={h} /></div>
    </button>
  )
}

export function GaragePage({ open, go }: { open: Open; go: (p: Page) => void }) {
  const { state, vehicle, saveVehicle } = useStore()
  const data = useMemo(() => {
    if (!vehicle) return null
    const items = state.maint.filter((m) => m.vehicleId === vehicle.id)
      .map((m) => ({ m, h: maintHealth(m, vehicle) }))
      // most urgent first; items whose last service is unknown are shown after the ones we can actually judge
      .sort((a, b) => Number(!!a.m.unknownLast) - Number(!!b.m.unknownLast) || b.h.pct - a.h.pct)
    return { items, overall: overallHealth(items.map(({ m, h }) => ({ name: m.name, h, unknown: m.unknownLast }))) }
  }, [state, vehicle])

  if (!vehicle || !data) return <Empty>No vehicles yet. Add one from More → Vehicles.</Empty>

  const next = data.items.find((i) => !i.m.unknownLast && i.h.status !== 'Healthy') ?? data.items.find((i) => !i.m.unknownLast)
  const urgent = data.items.filter((i) => !i.m.unknownLast && i.h.status !== 'Healthy').length

  return (
    <div className="page space-y-6">
      <VehicleHero v={vehicle} open={open} save={saveVehicle} go={go} />

      {next && <NextDue item={next.m} h={next.h} avgDailyKm={vehicle.avgDailyKm} onOpen={() => open({ kind: 'item', item: next.m })} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[22px] font-bold tracking-tight">Maintenance</h2>
          {data.items.length > 0 && (
            <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>
              {urgent > 0 ? `${urgent} need${urgent === 1 ? 's' : ''} attention` : `${data.items.length} tracked`}
            </p>
          )}
        </div>
        <OverallHealthCard o={data.overall} vehicleName={vehicle.nickname} />

        {data.items.length === 0 ? (
          <Empty>
            Nothing is being tracked for this vehicle yet.
            <div className="mt-3"><button className="btn-primary" onClick={() => open({ kind: 'setup', vehicleId: vehicle.id })}><Wrench size={16} /> Set up maintenance</button></div>
          </Empty>
        ) : (
          <>
            <ul className="group-list" aria-label="Service items">
              {data.items.map(({ m, h }) => <ServiceRow key={m.id} m={m} h={h} onOpen={() => open({ kind: 'item', item: m })} />)}
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

/** One service item: its part icon (tinted by status), name, status pill and both limits on a meter. Tapping opens the details. */
function ServiceRow({ m, h, onOpen }: { m: MaintItem; h: Health; onOpen: () => void }) {
  const interval = [m.intervalKm && `${num(m.intervalKm)} km`, m.intervalMonths && `${m.intervalMonths} mo`].filter(Boolean).join(' or ')
  const tone: PartTone = m.unknownLast ? 'check' : TONE[h.status]
  return (
    <li className="row !p-0">
      <button onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]">
        <PartIcon item={m} tone={tone} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block break-words text-[15px] font-medium leading-snug">{m.name}</span>
              <span className="block text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
                Every {interval}{m.unknownLast ? ' · last service unknown' : m.neverDone ? ' · never done yet' : ''}
              </span>
            </span>
            {m.unknownLast ? <Pill tone="check">Check</Pill> : <Pill tone={TONE[h.status]}>{h.status}</Pill>}
          </span>
          {!m.unknownLast && <span className="mt-2 block"><IntervalMeter h={h} /></span>}
        </span>
        <ChevronRight size={16} className="mt-3 shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
      </button>
    </li>
  )
}
