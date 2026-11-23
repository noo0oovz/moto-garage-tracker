import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Sheet on phones (slides up, grabber, rounded top), centred card on larger screens. Every dialog in the app uses it, so
 * this one component sets how all of them look. Escape and the scrim close it; focus is moved into it and restored after.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const before = document.activeElement as HTMLElement | null
    // Move focus into the dialog so keyboard and screen-reader users start inside it, and give it back on close.
    // Focus the panel itself, not the first field: focusing an <input> on a phone pops the on-screen keyboard open the
    // moment a form appears and hides half of it. Tab then moves into the fields from there.
    panel.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      before?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div className="anim-fade absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--scrim)' }} onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet md:anim-pop relative flex max-h-[92dvh] w-full flex-col outline-none md:max-w-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-sheet) var(--r-sheet) 0 0' }}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full md:hidden" style={{ background: 'var(--hairline)' }} aria-hidden />
        <div className="flex items-center justify-between px-5 pb-2 pt-2 md:pt-4">
          <h2 className="text-[17px] font-semibold leading-snug">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 grid h-11 w-11 place-items-center rounded-full" style={{ color: 'var(--text-2)' }}>
            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'var(--surface-2)' }}><X size={16} /></span>
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

/** iOS-style switch row. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-[15px]"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-ctl)' }}
    >
      <span>{label}</span>
      <span className="relative h-[28px] w-[46px] shrink-0 rounded-full transition-colors" style={{ background: checked ? 'var(--brand)' : 'var(--hairline)' }}>
        <span className={`absolute top-[2px] h-6 w-6 rounded-full shadow transition-all ${checked ? 'left-[20px]' : 'left-[2px]'}`} style={{ background: '#FFFFFF' }} />
      </span>
    </button>
  )
}

/** A thin progress hairline. `className` supplies the fill colour (a status or brand background). */
export function Progress({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--hairline)' }} role="presentation">
      <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="p-8 text-center text-[15px]" style={{ color: 'var(--text-2)', border: '1px dashed var(--hairline)', borderRadius: 'var(--r-card)' }}>
      {children}
    </div>
  )
}

export type PillTone = 'ok' | 'soon' | 'over' | 'check' | 'brand'
/** A status pill: dot + word on a tinted background. The word carries the meaning; colour only reinforces it. */
const PILL_CLASS: Record<PillTone, string> = { ok: 'pill-ok', soon: 'pill-soon', over: 'pill-over', check: 'pill-check', brand: 'pill-brand' }
export function Pill({ tone, children, dot = true }: { tone: PillTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`pill ${PILL_CLASS[tone]} shrink-0`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} aria-hidden />}
      {children}
    </span>
  )
}

/**
 * Segmented control (radio group). Arrow keys move the selection, as on iOS. Used for the theme choice, fuel/expense,
 * island groups and anywhere two to four mutually exclusive options sit side by side.
 */
export function Segmented<T extends string>({ value, onChange, options, label, className = '' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (i: number) => {
    const n = (i + options.length) % options.length
    onChange(options[n].value)
    refs.current[n]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-0.5 p-0.5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-ctl)' }}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i + 1) }
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i - 1) }
            }}
            className="min-h-11 rounded-[10px] px-2 text-[13px] font-semibold transition"
            style={on ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 0.5px var(--hairline)' } : { color: 'var(--text-2)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export const numVal = (s: string) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * A one-shot lock for form submission. A double tap on a slow phone fires the submit handler twice before the dialog
 * has closed, which would otherwise save the same record twice. Call `claim()` only once the form is valid and about
 * to save: it returns true the first time and false afterwards, so an invalid first attempt does not lock the form.
 */
export function useOnce() {
  const done = useRef(false)
  return useCallback(() => {
    if (done.current) return false
    done.current = true
    return true
  }, [])
}
