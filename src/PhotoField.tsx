import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { processPhoto, storageHeadroom } from './photo'
import { PhotoFramer } from './PhotoFramer'
import type { PhotoView } from './types'

/**
 * Add, change or remove a vehicle's photo. The picture is shrunk before it is kept (see photo.ts). If it would not fit in
 * the browser's remaining storage it is refused here, with a reason, instead of looking saved and vanishing on reload.
 */
export function PhotoField({ value, view, onChange, onView, stored }: {
  value: string | undefined
  view: PhotoView | undefined
  onChange: (photo: string | undefined) => void
  onView: (view: PhotoView | undefined) => void
  /** What is stored right now, as text, so the remaining space can be worked out. */
  stored: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (file?: File) => {
    if (!file) return
    setError(''); setBusy(true)
    try {
      const r = await processPhoto(file)
      if (!r.ok) { setError(r.reason); return }
      // Room check: the new picture replaces the old one, so give back the old one's size first.
      const free = storageHeadroom(stored) + (value?.length ?? 0)
      if (r.dataUrl.length > free) { setError('There is not enough storage left in this browser for a photo. Remove a photo from another vehicle, or export a backup and clear old data.'); return }
      onChange(r.dataUrl)
      onView(undefined) // a framing chosen for the old picture means nothing on a new one
    } finally {
      setBusy(false)
      if (input.current) input.current.value = '' // lets the same file be chosen again
    }
  }

  return (
    <div className="col-span-2">
      <span className="label">Photo (optional)</span>
      {value && <div className="mb-2"><PhotoFramer src={value} view={view} onChange={onView} /></div>}
      <div className="flex items-center gap-3">
        {!value && (
          <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-ctl)', color: 'var(--text-3)' }}>
            <Camera size={22} aria-hidden />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-ghost flex-1 sm:flex-none" disabled={busy} onClick={() => input.current?.click()}>
            <Camera size={16} /> {busy ? 'Preparing…' : value ? 'Change photo' : 'Add photo'}
          </button>
          {value && !busy && (
            <button type="button" className="btn-ghost flex-1 sm:flex-none" aria-label="Remove photo" onClick={() => { setError(''); onChange(undefined); onView(undefined) }}><Trash2 size={16} /> Remove</button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a vehicle photo" />
      <p className="mt-1.5 text-xs" style={{ color: 'var(--text-2)' }} aria-live="polite">
        {error ? <span role="alert" style={{ color: 'var(--over)' }}>{error}</span> : 'Shown in your Garage instead of the drawing. It is resized and kept only in this browser, and included in your backup.'}
      </p>
    </div>
  )
}
