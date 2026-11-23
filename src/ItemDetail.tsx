import { Check, Pencil } from 'lucide-react'
import { Modal, Pill } from './ui'
import { useStore } from './store'
import { fmtDate, maintHealth, num } from './logic'
import { GUIDE, type GuideKey } from './intervals'
import type { ModalState } from './modals'

const TONE = { Healthy: 'ok', 'Due Soon': 'soon', Overdue: 'over' } as const

/**
 * The detail sheet for one service item: where the real numbers, the plain-language "why", and the actions live, so the
 * list behind it can stay a clean, quiet column of rows. Reads the item from the store by id so it is never stale.
 */
export function ItemDetailModal({ itemId, close, openModal }: { itemId: string; close: () => void; openModal: (m: ModalState) => void }) {
  const { state, vehicle } = useStore()
  const m = state.maint.find((x) => x.id === itemId)
  if (!m || !vehicle) return null
  const h = maintHealth(m, vehicle)
  const guide = m.guideKey && m.guideKey in GUIDE ? GUIDE[m.guideKey as GuideKey] : null
  const interval = [m.intervalKm && `${num(m.intervalKm)} km`, m.intervalMonths && `${m.intervalMonths} months`].filter(Boolean).join(' or ')
  const source = m.source === 'booklet' ? 'From your service booklet' : m.source === 'general' ? 'General guidance, not from your car’s manual' : 'Set by you'
  const over = (n?: number) => n !== undefined && n < 0

  return (
    <Modal title={m.name} onClose={close}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {m.unknownLast ? <Pill tone="check">Check</Pill> : <Pill tone={TONE[h.status]}>{h.status}</Pill>}
          <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>Every {interval}</span>
        </div>

        {m.unknownLast ? (
          <p className="p-3 text-[15px]" style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-ctl)' }}>
            <b>We don’t know when this was last done.</b> If you remember, edit it and set the date. Otherwise, once it is done, tap Mark serviced.
          </p>
        ) : (
          <dl className="group-list">
            <div className="row justify-between"><dt style={{ color: 'var(--text-2)' }}>Distance left</dt>
              <dd className="num font-semibold" style={over(h.kmRemaining) ? { color: 'var(--over)' } : undefined}>
                {h.kmRemaining === undefined ? '—' : over(h.kmRemaining) ? `${num(-h.kmRemaining)} km over` : `${num(h.kmRemaining)} km`}</dd></div>
            <div className="row justify-between"><dt style={{ color: 'var(--text-2)' }}>Time left</dt>
              <dd className="num font-semibold" style={over(h.daysRemaining) ? { color: 'var(--over)' } : undefined}>
                {h.daysRemaining === undefined ? '—' : over(h.daysRemaining) ? `${-h.daysRemaining} days over` : `about ${h.daysRemaining} days`}</dd></div>
            <div className="row justify-between"><dt style={{ color: 'var(--text-2)' }}>Last done</dt>
              <dd className="num font-semibold">{num(m.lastServiceKm)} km · {fmtDate(m.lastServiceDate)}</dd></div>
          </dl>
        )}

        {guide && (
          <section>
            <h3 className="mb-1 text-[13px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>Why this matters</h3>
            <p className="text-[15px] leading-relaxed">{guide.why}</p>
          </section>
        )}
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{source}. If your service booklet says something different, tap Edit and use its number.</p>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => openModal({ kind: 'service', item: m })}><Check size={16} /> Mark serviced</button>
          <button className="btn-ghost" onClick={() => openModal({ kind: 'maint', item: m })}><Pencil size={16} /> Edit</button>
        </div>
      </div>
    </Modal>
  )
}
