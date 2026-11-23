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
