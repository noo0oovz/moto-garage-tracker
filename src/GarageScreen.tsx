import { useMemo } from 'react'
import { ChevronRight, Plus, Wrench } from 'lucide-react'
import { useStore } from './store'
import { Empty } from './ui'
import { IntervalMeter } from './IntervalMeter'
import { PartIcon, type PartTone } from './PartIcon'
import { VehicleHero } from './VehicleHero'
import type { ModalState } from './modals'
import type { MaintItem, Page } from './types'
import { maintHealth, num, overallHealth, rowStatus, type Health, type OverallHealth, type OverallLevel } from './logic'

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

/**
 * Overall vehicle health: a thin ring with the score, a two-word status and the counts. Quiet on purpose, because the list
 * below carries the detail. The longer explanation only appears when there is no score yet, since a new owner needs to be
 * told what to do next.
 */
export function OverallHealthCard({ o, vehicleName }: { o: OverallHealth; vehicleName: string }) {
  const st = LEVEL[o.level]
  const R = 44, C = 2 * Math.PI * R
  const stroke = st.tone === 'check' ? 'var(--text-3)' : `var(--${st.tone})`
  const noScore = o.score === null
  return (
    <div className="card p-4" role="group" aria-label={`Overall health of ${vehicleName}`}>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0" aria-hidden>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="4" stroke="var(--hairline)" />
            {o.score !== null && (
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="4" strokeLinecap="round" stroke={stroke} className="transition-all duration-700"
                strokeDasharray={C} strokeDashoffset={C * (1 - o.score / 100)} />
            )}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <p className="num text-[24px] font-semibold leading-none tracking-tight">{o.score ?? '—'}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>Overall health</p>
          <p className="text-[20px] font-semibold leading-tight tracking-tight" style={{ color: st.tone === 'check' ? 'var(--text)' : `var(--${st.tone})` }}>
            {o.score !== null && <span className="sr-only">{o.score} out of 100. </span>}{st.label}
          </p>
          {o.total > 0 && (
            <p className="num mt-1 flex flex-wrap gap-x-3 text-[13px]">
              {o.healthy > 0 && <span style={{ color: 'var(--ok)' }}>{o.healthy} Healthy</span>}
              {o.dueSoon > 0 && <span style={{ color: 'var(--soon)' }}>{o.dueSoon} Due soon</span>}
              {o.overdue > 0 && <span style={{ color: 'var(--over)' }}>{o.overdue} Overdue</span>}
              {o.unknown > 0 && <span style={{ color: 'var(--text-2)' }}>{o.unknown} To check</span>}
            </p>
          )}
        </div>
      </div>
      {noScore && <p className="mt-3 text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>{st.blurb}</p>}
      {!noScore && o.unknown > 0 && (
        <p className="mt-3 text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
          {o.unknown} of {o.total} items still need a date and are left out of the score. Tap one to set it.
        </p>
      )}
    </div>
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

  return (
    <div className="page space-y-5">
      <VehicleHero v={vehicle} open={open} save={saveVehicle} go={go} />

      <section className="space-y-3">
        <h2 className="px-1 text-[20px] font-semibold tracking-tight">Maintenance</h2>
        <OverallHealthCard o={data.overall} vehicleName={vehicle.nickname} />

        {data.items.length === 0 ? (
          <Empty>
            Nothing is being tracked for this vehicle yet.
            <div className="mt-3"><button className="btn-primary" onClick={() => open({ kind: 'setup', vehicleId: vehicle.id })}><Wrench size={16} /> Set up maintenance</button></div>
          </Empty>
        ) : (
          <>
            <ul className="card divide-y overflow-hidden" aria-label="Service items">
              {data.items.map(({ m, h }) => <ServiceRow key={m.id} m={m} h={h} avgDailyKm={vehicle.avgDailyKm} onOpen={() => open({ kind: 'item', item: m })} />)}
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

/**
 * One service item as a clean row: an icon in a soft tinted circle, the name, the interval, a thin bar, and on the right
 * what matters in words ("2 days over", "1,600 km left"). The words and the bar colour carry the status, so no badge is
 * repeated down the list. The status is also in the row's accessible name, so it never depends on colour alone.
 */
function ServiceRow({ m, h, avgDailyKm, onOpen }: { m: MaintItem; h: Health; avgDailyKm: number; onOpen: () => void }) {
  const interval = [m.intervalKm && `${num(m.intervalKm)} km`, m.intervalMonths && `${m.intervalMonths} mo`].filter(Boolean).join(' or ')
  const tone: PartTone = m.unknownLast ? 'check' : TONE[h.status]
  const st = m.unknownLast ? { text: 'Check', over: false } : rowStatus(m, h, avgDailyKm)
  const colour = m.unknownLast ? 'var(--text-2)' : h.status === 'Overdue' ? 'var(--over)' : h.status === 'Due Soon' ? 'var(--soon)' : 'var(--text-2)'
  const word = m.unknownLast ? 'last service unknown' : h.status === 'Healthy' ? 'healthy' : h.status === 'Due Soon' ? 'due soon' : 'overdue'
  return (
    <li style={{ borderColor: 'var(--hairline)' }}>
      <button onClick={onOpen} aria-label={`${m.name}, ${word}${st.text ? `, ${st.text}` : ''}. Open details`}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--surface-2)]">
        <PartIcon item={m} tone={tone} size={36} round />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[15px] font-medium leading-snug">{m.name}</span>
          <span className="block text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
            Every {interval}{m.unknownLast ? ' · last service unknown' : m.neverDone ? ' · never done yet' : ''}
          </span>
          {!m.unknownLast && <span className="mt-2 block"><IntervalMeter h={h} slim /></span>}
        </span>
        <span className="num shrink-0 whitespace-nowrap text-right text-[13px] font-medium leading-tight" style={{ color: colour }}>{st.text}</span>
        <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
      </button>
    </li>
  )
}
