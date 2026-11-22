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
