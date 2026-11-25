import { ChevronRight } from 'lucide-react'
import type { Vehicle } from './types'
import { artKind } from './VehicleArt'
import { VehicleLine } from './VehicleLine'
import { FramedPhoto } from './FramedPhoto'
import { codingStatus, num, todayISO } from './logic'
import { MONTH_NAMES, nextRenewal, reminderLevel } from './plate'
import type { ModalState } from './modals'

type Tone = 'neutral' | 'ok' | 'soon' | 'over'

/**
 * Coding day and registration as plain text: small, muted, separated by dots. A part is coloured only when it needs action
 * (coding today; registration due soon or overdue; registered is the one quiet success). Tappable where there is something
 * to do, such as marking the vehicle registered.
 */
export function metaItems(v: Vehicle, open: (m: ModalState) => void, save: (v: Vehicle) => void) {
  const items: { key: string; tone: Tone; text: string; onClick?: () => void; label?: string }[] = []

  const c = codingStatus(v)
  if (c.state === 'coding') items.push({ key: 'coding', tone: 'over', text: `Coding today · ${c.today}` })
  else if (c.state === 'exempt') items.push({ key: 'coding', tone: 'neutral', text: 'No number coding' })
  else items.push({ key: 'coding', tone: 'neutral', text: c.label })

  const r = nextRenewal(v.plate, v.type, todayISO(), v.registeredFor)
  if (!r) {
    items.push({ key: 'reg', tone: 'neutral', text: 'Add plate for registration', onClick: () => open({ kind: 'vehicle', item: v }), label: 'Add a plate number to see the registration month' })
  } else {
    const level = reminderLevel(r)
    const month = MONTH_NAMES[r.month - 1]
    const mark = () => save({ ...v, registeredFor: r.deadline })
    if (level === 'none') items.push({ key: 'reg', tone: 'ok', text: `Registered · ${month}`, onClick: () => save({ ...v, registeredFor: undefined }), label: `Registered for ${month}. Tap to undo` })
    else if (level === 'info') items.push({ key: 'reg', tone: 'neutral', text: `Registration · ${month}`, onClick: mark, label: `Registration due ${month}. Tap if already registered` })
    else items.push({
      key: 'reg', tone: level === 'overdue' ? 'over' : 'soon',
      text: level === 'overdue' ? `Registration overdue · ${month}` : r.daysLeft === 0 ? 'Registration due today' : `Registration in ${r.daysLeft}d`,
      onClick: mark, label: 'Registration needs attention. Tap if already registered',
    })
  }
  return items
}

/** The line under the name: plate and make/model, leaving out whatever the nickname already says. */
export function subtitle(v: Pick<Vehicle, 'nickname' | 'plate' | 'make' | 'model' | 'year' | 'type'>): string {
  const year = Number.isFinite(v.year) && v.year > 0 ? String(v.year) : ''
  const full = `${year} ${v.make} ${v.model}`.replace(/\s+/g, ' ').trim()
  const nick = v.nickname.toLowerCase()
  // drop make/model/year already contained in the nickname, so "2018 Toyota Hilux G 4x2" is not printed twice
  const rest = full && !nick.includes(full.toLowerCase()) && !full.toLowerCase().includes(nick) ? full : ''
  return [v.plate, rest].filter(Boolean).join(' · ') || (v.type === 'car' ? 'Car' : 'Motorcycle')
}

/**
 * The top of the Garage. The odometer is the figure that matters, so it is the largest thing here; the name and plate sit
 * above it and a single muted line of coding and registration facts below. The illustration is a thin outline so it
 * blends with the surface instead of competing with the numbers.
 */
export function VehicleHero({ v, open, save, go }: {
  v: Vehicle; open: (m: ModalState) => void; save: (v: Vehicle) => void; go: (p: 'fuelwatch') => void
}) {
  const meta = metaItems(v, open, save)
  const kind = artKind(v)
  const colour = (t: Tone) => (t === 'neutral' ? 'var(--text-2)' : `var(--${t})`)
  return (
    <section className="card overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center" aria-label={`${v.nickname} summary`}>
      <div className="px-5 pt-5 md:col-start-1 md:row-start-1">
        <h2 className="break-words text-[17px] font-semibold leading-snug tracking-tight">{v.nickname}</h2>
        <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{subtitle(v)}</p>
        {/* the dominant figure */}
        <p className="num mt-3 text-[44px] font-bold leading-none tracking-tight" aria-label={`Odometer ${num(v.odometer)} kilometres`}>
          {num(v.odometer)}<span className="ml-1.5 text-[17px] font-medium tracking-normal" style={{ color: 'var(--text-2)' }}>km</span>
        </p>
        <p className="num mt-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>~{num(v.avgDailyKm)} km/day</p>
      </div>

      <div className="px-5 py-3 md:col-start-2 md:row-span-2 md:row-start-1 md:p-6" style={{ color: 'var(--text-2)' }}>
        {v.photo ? (
          // the owner's own picture, framed the way they chose; the same shape every vehicle uses so they line up
          <FramedPhoto src={v.photo} view={v.photoView} alt={`Photo of ${v.nickname}`} className="mx-auto max-w-[420px]" style={{ borderRadius: 'var(--r-ctl)', border: '1px solid var(--hairline)' }} />
        ) : (
          <VehicleLine kind={kind} className="mx-auto block h-auto w-full max-w-[300px]" />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-4 text-[13px] md:col-start-1 md:row-start-2">
        {/* No dot separators: when the row wraps, a dot can be stranded at the start of a line. Gaps do the separating. */}
        <p className="flex min-w-0 flex-wrap items-center gap-x-4">
          {meta.map((m) => {
            const inner = <span style={{ color: colour(m.tone), fontWeight: m.tone === 'neutral' ? 400 : 500 }}>{m.text}</span>
            return m.onClick
              ? <button key={m.key} type="button" onClick={m.onClick} aria-label={m.label} className="-my-2 inline-flex min-h-11 items-center transition active:opacity-60">{inner}</button>
              : <span key={m.key}>{inner}</span>
          })}
        </p>
        <button type="button" onClick={() => go('fuelwatch')} aria-label="Open Fuel Watch" className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 transition active:opacity-60" style={{ color: 'var(--text-2)' }}>
          Fuel prices <ChevronRight size={14} aria-hidden />
        </button>
      </div>
    </section>
  )
}
