import { useEffect, useState } from 'react'

export type LayoutMode = 'phone' | 'compact' | 'tablet' | 'desktop'

/**
 * Which shell to render. Width alone is not enough: a phone held sideways is 600-950px wide but only 320-430px
 * tall, so it must not get a tall tablet header plus a bottom bar.
 *
 *  - desktop : width >= 1024 (full sidebar; it scrolls on its own when the window is short)
 *  - compact : landscape and height <= 520, narrower than 1024 (slim left rail, one-line top bar, no bottom bar)
 *  - tablet  : 768 <= width < 1024 (left rail + top bar)
 *  - phone   : everything else (top header + bottom navigation)
 */
export function layoutFor(width: number, height: number): LayoutMode {
  if (width >= 1024) return 'desktop'
  const landscape = width > height
  if (landscape && height <= 520) return 'compact'
  if (width >= 768) return 'tablet'
  return 'phone'
}

export function useLayout(): LayoutMode {
  const read = () => layoutFor(window.innerWidth, window.innerHeight)
  const [mode, setMode] = useState<LayoutMode>(read)
  useEffect(() => {
    const on = () => setMode(read())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return mode
}

/** True while the viewport is at least `px` wide. Use to render ONE of two alternative views instead of both. */
export function useMinWidth(px: number): boolean {
  const q = `(min-width: ${px}px)`
  const [on, setOn] = useState(() => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(q).matches : false))
  useEffect(() => {
    const m = window.matchMedia(q)
    const h = () => setOn(m.matches)
    h()
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [q])
  return on
}
