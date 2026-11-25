import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * How many dialogs are open. The page scroll lock belongs to the count, not to any one dialog: if each saved and
 * restored "the previous overflow" itself, two overlapping dialogs could restore a stale 'hidden' and leave the page
 * permanently unscrollable.
 */
let openDialogs = 0
function lockScroll() { if (openDialogs++ === 0) document.body.style.overflow = 'hidden' }
function unlockScroll() { if (--openDialogs <= 0) { openDialogs = 0; document.body.style.overflow = '' } }

/**
 * Sheet on phones (slides up, grabber, rounded top), centred card on larger screens. Every dialog in the app uses it, so
 * this one component sets how all of them look. Escape and the scrim close it; focus is moved into it and restored after.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  // Callers pass a fresh inline function each render. Keep the latest in a ref so the effect below runs once per dialog,
  // not on every re-render (which would re-lock, re-focus and fight the user's scrolling).
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    lockScroll()
    const before = document.activeElement as HTMLElement | null
    // Move focus into the dialog so keyboard and screen-reader users start inside it, and give it back on close.
    // Focus the panel itself, not the first field: focusing an <input> on a phone pops the on-screen keyboard open the
    // moment a form appears and hides half of it. Tab then moves into the fields from there.
    panel.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
      before?.focus?.({ preventScroll: true })
    }
  }, [])

  // Rendered on <body>, not in place: a parent with backdrop-filter or transform (the translucent header) would otherwise
  // become the containing block for 'fixed', shrinking the dialog and its scrim to the header's box.
  return createPortal(
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
    </div>,
    document.body,
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

/**
 * The title at the top of a page, with an optional quiet action on the right. Every page uses it, so titles are the same
 * size and weight everywhere and the action sits in the same place.
 */
export function PageHeader({ title, sub, action, sectionTitle = false }: { title: string; sub?: ReactNode; action?: ReactNode; /** A heading inside a page (not the page's own title): always shown. */ sectionTitle?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 px-1 ${sectionTitle ? 'items-end' : 'items-end md:items-center'}`}>
      <div className="min-w-0">
        {/* Tablet and desktop already show the page title in the top bar, so the page's own title is for phones only. */}
        <h2 className={`break-words text-[20px] font-semibold leading-tight tracking-tight ${sectionTitle ? '' : 'md:sr-only'}`}>{title}</h2>
        {sub && <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** One card holding a list, rows separated by hairlines. The shared shape for every list in the app. */
export function ListCard({ children, label, className = '' }: { children: ReactNode; label?: string; className?: string }) {
  return <ul className={`card divide-y overflow-hidden ${className}`} aria-label={label}>{children}</ul>
}

/** A small headline figure with a muted caption: spend totals, counts, averages. Numbers use tabular figures. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'soon' | 'over' }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>{label}</p>
      {/* a figure is never split across lines: it stays whole and gives up a little size when it is very large */}
      <p className="num whitespace-nowrap text-[clamp(16px,5.6vw,22px)] font-semibold leading-tight tracking-tight sm:text-[22px]" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</p>
      {sub && <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{sub}</p>}
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

/** Largest number a form accepts. Matches the import limit in migrate.ts, so what you can type is what can be loaded back. */
export const MAX_VALUE = 1e9
/** Parses a typed number. Blank, non-numeric and absurdly large input all count as 0, so the form stays invalid instead of saving junk. */
export const numVal = (s: string) => {
  const n = parseFloat(s)
  return Number.isFinite(n) && Math.abs(n) <= MAX_VALUE ? n : 0
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
