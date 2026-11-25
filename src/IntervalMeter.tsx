import { limits, type Health, type Status } from './logic'

const FILL: Record<Status, string> = { Healthy: 'var(--ok)', 'Due Soon': 'var(--soon)', Overdue: 'var(--over)' }

/**
 * How much of an interval has been used, as a bar in the status colour, with both limits written underneath: distance
 * left and time left, or how far past each one is. The bar and the words say the same thing, so colour is never the only
 * signal. `compact` drops the words for tight spaces; the bar then carries an accessible label of its own.
 */
export function IntervalMeter({ h, compact = false, slim = false }: { h: Health; compact?: boolean; slim?: boolean }) {
  const { km, time } = limits(h)
  const pct = Math.max(0, Math.min(100, h.pct))
  const summary = [km.known && km.label, time.known && time.label].filter(Boolean).join(', ') || 'no limits set'
  return (
    <div>
      <div className={`relative w-full overflow-hidden rounded-full ${slim ? "h-[3px]" : "h-1.5"}`} style={{ background: 'var(--hairline)' }} role="img" aria-label={`${Math.round(pct)}% of the interval used: ${summary}`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: FILL[h.status] }} />
        {/* the 85% mark: past it the item is "due soon" */}
        <span className="absolute inset-y-0 w-px" style={{ left: '85%', background: 'var(--surface)', opacity: 0.9 }} aria-hidden />
      </div>
      {!compact && !slim && (km.known || time.known) && (
        <div className="num mt-1.5 flex flex-wrap justify-between gap-x-3 text-[13px]" style={{ color: 'var(--text-2)' }}>
          {km.known && <span style={km.over ? { color: 'var(--over)', fontWeight: 600 } : undefined}>{km.label}</span>}
          {time.known && <span style={time.over ? { color: 'var(--over)', fontWeight: 600 } : undefined}>{time.label}</span>}
        </div>
      )}
    </div>
  )
}
