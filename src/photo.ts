// Vehicle photos. A photo is stored on the vehicle as a small JPEG data URL, so it lives in the same place as everything
// else and travels with the JSON backup. The browser keeps only about 5 MB for the whole app, and a phone photo is
// several MB, so every photo is shrunk and re-encoded before it is stored.

/** Longest side, in pixels, of a stored photo. Big enough to look sharp in the Garage header, small enough to store. */
export const PHOTO_MAX_SIDE = 960
/** JPEG quality used when shrinking. */
export const PHOTO_QUALITY = 0.8
/** Largest stored photo, in characters of the data URL (about 340 KB of image). A bigger one is refused, never stored. */
export const PHOTO_MAX_CHARS = 460_000
/** Largest file a person may pick, before it is shrunk. Stops a multi-hundred-MB file from being read into memory. */
export const PHOTO_MAX_FILE_BYTES = 25 * 1024 * 1024

/**
 * Whether a value may be kept as a vehicle photo. Only a JPEG, PNG or WebP data URL of sensible size passes. This is the
 * single gate for photos coming from a backup file too, so a hand-edited backup cannot smuggle in a script URL, a remote
 * address (which would make the app load something from the internet) or a huge blob that fills the storage.
 */
export function isPhoto(x: unknown): x is string {
  return typeof x === 'string' && x.length <= PHOTO_MAX_CHARS && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(x)
}

/** The size to draw a photo at so its longest side is `max`, keeping the proportions. Never enlarges, never returns 0. */
export function fitWithin(w: number, h: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return { width: 1, height: 1 }
  const scale = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

export type PhotoResult = { ok: true; dataUrl: string } | { ok: false; reason: string }

/**
 * Read a picked file, shrink it, and return a JPEG data URL, or say plainly why not. Never throws.
 * Steps down in quality and size if the first result is still too big for the budget.
 */
export async function processPhoto(file: File): Promise<PhotoResult> {
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'That file is not a picture. Choose a photo (JPG, PNG or WebP).' }
  if (file.size > PHOTO_MAX_FILE_BYTES) return { ok: false, reason: 'That picture is too large. Choose one under 25 MB.' }
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    // createImageBitmap applies the camera's rotation, so portrait phone photos are not stored sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return { ok: false, reason: 'That picture could not be read. Try a different photo, or a JPG or PNG.' }
  }
  try {
    for (const [side, quality] of [[PHOTO_MAX_SIDE, PHOTO_QUALITY], [720, 0.72], [480, 0.65], [320, 0.6]] as const) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, side)
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return { ok: false, reason: 'This browser could not prepare the picture.' }
      // a transparent PNG becomes black in a JPEG, so paint white underneath first
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (isPhoto(dataUrl)) return { ok: true, dataUrl }
    }
    return { ok: false, reason: 'That picture is too detailed to store. Try a smaller one.' }
  } finally {
    if ('close' in bitmap) bitmap.close()
  }
}

/** Characters still free in the app's roughly 5 MB of browser storage, given what is stored now. Never negative. */
export function storageHeadroom(current: string, limit = 5_000_000): number {
  return Math.max(0, limit - current.length)
}

// ---- Framing: which part of the photo shows, and how far it is zoomed -----------------------------------------------
import type { PhotoView } from './types'

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3
/** Less movement than this, in pixels, is not worth offering. */
export const MIN_TRAVEL = 4
export const DEFAULT_VIEW: PhotoView = { x: 50, y: 50, zoom: 1 }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const num = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Make any value into a safe view. Unusable parts fall back to the centre / no zoom, and the default view is "no view". */
export function cleanView(v: unknown): PhotoView | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const view = { x: round2(clamp(num(o.x, 50), 0, 100)), y: round2(clamp(num(o.y, 50), 0, 100)), zoom: round2(clamp(num(o.zoom, 1), ZOOM_MIN, ZOOM_MAX)) }
  return view.x === 50 && view.y === 50 && view.zoom === 1 ? undefined : view
}

/**
 * The CSS that draws a photo with a view, shared by the editor and every place the photo is shown, so what you frame is
 * exactly what you see. The photo sits in a box `zoom` times the frame, slid by the view; inside it the picture covers
 * the box and is positioned by the same x and y. Percentages only, so it holds at any frame size.
 */
export function frameLayout(view: PhotoView | undefined) {
  const v = cleanView(view) ?? DEFAULT_VIEW
  const extra = v.zoom - 1
  return {
    inner: { width: `${round2(v.zoom * 100)}%`, height: `${round2(v.zoom * 100)}%`, left: `${round2(-extra * v.x)}%`, top: `${round2(-extra * v.y)}%` },
    objectPosition: `${v.x}% ${v.y}%`,
  }
}

/**
 * How many pixels the picture can travel in each direction inside a frame of cw x ch, for a picture of iw x ih at this
 * zoom. Zero means there is nothing to move (the picture exactly fits and is not zoomed).
 */
export function panRange(cw: number, ch: number, iw: number, ih: number, zoom: number): { x: number; y: number } {
  if (![cw, ch, iw, ih].every((n) => Number.isFinite(n) && n > 0)) return { x: 0, y: 0 }
  const z = clamp(num(zoom, 1), ZOOM_MIN, ZOOM_MAX)
  const s = Math.max(cw / iw, ch / ih) // scale at which the picture just covers the frame
  // Whole-pixel frame sizes make a picture of exactly the frame's shape look a pixel or two too big. Anything under
  // MIN_TRAVEL px is "nothing to move", so the editor never offers a drag that would do nothing.
  const snap = (n: number) => (n < MIN_TRAVEL ? 0 : n)
  return { x: snap((z - 1) * cw + z * Math.max(0, iw * s - cw)), y: snap((z - 1) * ch + z * Math.max(0, ih * s - ch)) }
}

/** Move a view by a drag of (dx, dy) pixels: dragging the picture right shows more of its left side. */
export function dragView(start: PhotoView, dx: number, dy: number, range: { x: number; y: number }): PhotoView {
  const move = (p: number, d: number, r: number) => (r > 0 && Number.isFinite(d) ? clamp(p - (d / r) * 100, 0, 100) : p)
  return { ...start, x: round2(move(start.x, dx, range.x)), y: round2(move(start.y, dy, range.y)) }
}

/** Nudge a view by a percentage of its travel, for the keyboard. */
export function nudgeView(view: PhotoView, dx: number, dy: number): PhotoView {
  return { ...view, x: round2(clamp(view.x + dx, 0, 100)), y: round2(clamp(view.y + dy, 0, 100)) }
}
