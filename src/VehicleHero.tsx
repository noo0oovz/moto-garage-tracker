import { CalendarClock, CheckCircle2, MapPin, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { Vehicle } from './types'
import { artKind, VehicleArt } from './VehicleArt'
import { FramedPhoto } from './FramedPhoto'
import { codingStatus, num, todayISO } from './logic'
import { MONTH_NAMES, nextRenewal, reminderLevel } from './plate'
import type { ModalState } from './modals'

type Tone = 'neutral' | 'ok' | 'soon' | 'over'

/** A compact status chip: icon and a few words, coloured only when something needs doing. Optionally tappable. */
export function StatusChip({ icon: Icon, tone = 'neutral', children, onClick, label }: {
  icon: LucideIcon; tone?: Tone; children: React.ReactNode; onClick?: () => void; label?: string
}) {
  const coloured = tone !== 'neutral'
  const style = coloured ? { background: `var(--${tone}-bg)`, color: `var(--${tone})` } : { background: 'var(--surface-2)', color: 'var(--text-2)' }
  const cls = 'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium leading-tight'
  const inner = <><Icon size={14} className="shrink-0" aria-hidden /><span className="min-w-0">{children}</span></>
  return onClick
    ? <button type="button" onClick={onClick} aria-label={label} className={`${cls} min-h-11 transition active:scale-[0.98]`} style={style}>{inner}</button>
    : <span className={cls} style={style}>{inner}</span>
}

/** Coding day and registration, as the one or two chips that matter. Words are short; the full note is the chip's tooltip. */
export function statusChips(v: Vehicle, open: (m: ModalState) => void, save: (v: Vehicle) => void) {
  const chips: { key: string; icon: LucideIcon; tone: Tone; text: string; onClick?: () => void; label?: string }[] = []

  const c = codingStatus(v)
  if (c.state === 'coding') chips.push({ key: 'coding', icon: ShieldAlert, tone: 'over', text: `Coding today · ${c.today}` })
  else if (c.state === 'exempt') chips.push({ key: 'coding', icon: ShieldCheck, tone: 'neutral', text: 'No number coding' })
  else chips.push({ key: 'coding', icon: ShieldCheck, tone: 'neutral', text: c.label })

  const r = nextRenewal(v.plate, v.type, todayISO(), v.registeredFor)
  if (!r) {
    chips.push({ key: 'reg', icon: CalendarClock, tone: 'neutral', text: 'Add plate for registration', onClick: () => open({ kind: 'vehicle', item: v }), label: 'Add a plate number to see the registration month' })
  } else {
    const level = reminderLevel(r)
    const month = MONTH_NAMES[r.month - 1]
    const mark = () => save({ ...v, registeredFor: r.deadline })
    if (level === 'none') chips.push({ key: 'reg', icon: CheckCircle2, tone: 'ok', text: `Registered · ${month}`, onClick: () => save({ ...v, registeredFor: undefined }), label: `Registered for ${month}. Tap to undo` })
    else if (level === 'info') chips.push({ key: 'reg', icon: CalendarClock, tone: 'neutral', text: `Registration · ${month}`, onClick: mark, label: `Registration due ${month}. Tap if already registered` })
    else chips.push({
      key: 'reg', icon: CalendarClock, tone: level === 'overdue' ? 'over' : 'soon',
      text: level === 'overdue' ? `Registration overdue · ${month}` : r.daysLeft === 0 ? 'Registration due today' : `Registration in ${r.daysLeft}d`,
      onClick: mark, label: 'Registration needs attention. Tap if already registered',
    })
  }
  return chips
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
 * The top of the Garage: the vehicle's illustration, name, plate and odometer, then the compact status chips. It tells
 * you which vehicle you are looking at before anything else, and keeps the coding and registration facts to one line.
 */
export function VehicleHero({ v, open, save, go }: {
  v: Vehicle; open: (m: ModalState) => void; save: (v: Vehicle) => void; go: (p: 'fuelwatch') => void
}) {
  const chips = statusChips(v, open, save)
  const kind = artKind(v)
  return (
    <section className="card overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center" aria-label={`${v.nickname} summary`}>
      {/* the illustration comes second in the markup (after the name) but sits on the right on wide screens */}
      <div className="px-5 pt-5 md:col-start-1 md:row-start-1 md:pb-0">
        <h2 className="break-words text-[22px] font-bold leading-tight tracking-tight">{v.nickname}</h2>
        <p className="num mt-0.5 text-[15px]" style={{ color: 'var(--text-2)' }}>{subtitle(v)}</p>
      </div>
      <div className="px-5 pb-1 pt-2 md:col-start-2 md:row-span-3 md:row-start-1 md:p-6" style={{ color: 'var(--brand)' }}>
        {v.photo ? (
          // the owner's own picture, framed the way they chose; the same shape every vehicle uses so they line up
          <FramedPhoto src={v.photo} view={v.photoView} alt={`Photo of ${v.nickname}`} className="mx-auto max-w-[420px]" style={{ borderRadius: 'var(--r-ctl)', border: '1px solid var(--hairline)' }} />
        ) : (
          <div className="relative mx-auto max-w-[340px]">
            <VehicleArt kind={kind} className="block h-auto w-full" style={{ ['--art-cut' as string]: 'var(--surface)' }} />
            {/* a thin floor line under the wheels, so the illustration feels placed rather than floating */}
            <div className="absolute inset-x-6 bottom-0 h-px" style={{ background: 'var(--hairline)' }} aria-hidden />
          </div>
        )}
      </div>
      <dl className="num mx-5 mt-2 grid grid-cols-2 gap-px overflow-hidden text-center md:col-start-1 md:row-start-2" style={{ background: 'var(--hairline)', borderRadius: 'var(--r-ctl)' }}>
        <div className="px-3 py-2" style={{ background: 'var(--surface-2)' }}>
          <dt className="text-[12px]" style={{ color: 'var(--text-2)' }}>Odometer</dt>
          <dd className="text-[17px] font-bold leading-tight tracking-tight">{num(v.odometer)} <span className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>km</span></dd>
        </div>
        <div className="px-3 py-2" style={{ background: 'var(--surface-2)' }}>
          <dt className="text-[12px]" style={{ color: 'var(--text-2)' }}>Daily use</dt>
          <dd className="text-[17px] font-bold leading-tight tracking-tight">~{num(v.avgDailyKm)} <span className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>km</span></dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5 pt-3 md:col-start-1 md:row-start-3">
        {chips.map((c) => (
          <StatusChip key={c.key} icon={c.icon} tone={c.tone} onClick={c.onClick} label={c.label}>{c.text}</StatusChip>
        ))}
        <StatusChip icon={MapPin} tone="neutral" onClick={() => go('fuelwatch')} label="Open Fuel Watch">Fuel prices</StatusChip>
      </div>
    </section>
  )
}
