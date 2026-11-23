import type { CSSProperties } from 'react'
import { frameLayout } from './photo'
import type { PhotoView } from './types'

/** The shape every vehicle photo is shown in. The editor uses the same one, so what you frame is what you see. */
export const PHOTO_ASPECT = '16 / 10'

/**
 * A vehicle photo drawn with its saved framing. Used in the Garage header, on the Vehicles page and in the editor, so
 * the three can never disagree about what part of the picture shows.
 */
export function FramedPhoto({ src, view, alt = '', className = '', style }: {
  src: string; view?: PhotoView; alt?: string; className?: string; style?: CSSProperties
}) {
  const L = frameLayout(view)
  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: PHOTO_ASPECT, ...style }}>
      <div className="absolute" style={L.inner}>
        <img src={src} alt={alt} draggable={false} className="block h-full w-full select-none object-cover" style={{ objectPosition: L.objectPosition }} />
      </div>
    </div>
  )
}
