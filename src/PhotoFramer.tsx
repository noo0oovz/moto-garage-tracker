import { useEffect, useRef, useState } from 'react'
import { Move, RotateCcw, ZoomIn } from 'lucide-react'
import { FramedPhoto } from './FramedPhoto'
import { DEFAULT_VIEW, ZOOM_MAX, ZOOM_MIN, dragView, nudgeView, panRange } from './photo'
import type { PhotoView } from './types'

/**
 * Lets the owner choose which part of a photo shows: drag it to slide, or use the zoom slider to go closer. The frame is
 * the same shape the Garage uses, so this is exactly what will be shown. Works with a mouse, a finger, a pen and the
 * keyboard (arrow keys move, + and - zoom).
 */
export function PhotoFramer({ src, view, onChange }: { src: string; view: PhotoView | undefined; onChange: (v: PhotoView | undefined) => void }) {
  const v = view ?? DEFAULT_VIEW
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; start: PhotoView } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [dragging, setDragging] = useState(false)

  // the real size of the frame, so dragging uses actual pixels (and survives a rotation or a resize)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // the picture's own proportions
  useEffect(() => {
    let live = true
    const img = new Image()
    img.onload = () => { if (live) setNatural({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.src = src
    return () => { live = false }
  }, [src])

  const range = panRange(size.w, size.h, natural.w, natural.h, v.zoom)
  const canMove = range.x > 0 || range.y > 0
  const set = (next: PhotoView) => onChange(next.x === 50 && next.y === 50 && next.zoom === 1 ? undefined : next)

  const onDown = (e: React.PointerEvent) => {
    if (!canMove) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: v }
    setDragging(true)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (d) set(dragView(d.start, e.clientX - d.x, e.clientY - d.y, range))
  }
  const onUp = () => { drag.current = null; setDragging(false) }
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 3
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[e.key]) { e.preventDefault(); set(nudgeView(v, ...moves[e.key])) }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); set({ ...v, zoom: Math.min(ZOOM_MAX, Math.round((v.zoom + 0.25) * 100) / 100) }) }
    else if (e.key === '-') { e.preventDefault(); set({ ...v, zoom: Math.max(ZOOM_MIN, Math.round((v.zoom - 0.25) * 100) / 100) }) }
  }

  return (
    <div className="space-y-2">
      <div
        ref={frame}
        role="group" tabIndex={0} onKeyDown={onKey}
        aria-label="Photo position. Drag to move the photo, or use the arrow keys. Plus and minus change the zoom."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className="relative w-full overflow-hidden outline-none"
        style={{ borderRadius: 'var(--r-ctl)', border: '1px solid var(--hairline)', touchAction: 'none', cursor: canMove ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <FramedPhoto src={src} view={view} />
        {canMove && (
          <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
            <Move size={12} aria-hidden /> Drag to move
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ZoomIn size={16} className="shrink-0" style={{ color: 'var(--text-2)' }} aria-hidden />
        <input
          type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.05} value={v.zoom} aria-label="Zoom"
          onChange={(e) => set({ ...v, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(e.target.value))) })}
          className="h-11 min-w-0 flex-1" style={{ accentColor: 'var(--brand)' }}
        />
        <span className="num w-10 shrink-0 text-right text-[13px]" style={{ color: 'var(--text-2)' }}>{v.zoom.toFixed(1)}×</span>
        <button type="button" className="btn-ghost !px-3" onClick={() => onChange(undefined)} disabled={!view} aria-label="Reset position and zoom"><RotateCcw size={16} /></button>
      </div>
      {!canMove && natural.w > 0 && <p className="text-xs" style={{ color: 'var(--text-2)' }}>This photo already fits the frame. Zoom in to choose which part shows.</p>}
    </div>
  )
}
