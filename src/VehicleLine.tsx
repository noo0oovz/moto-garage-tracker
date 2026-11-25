import type { CSSProperties, ReactElement } from 'react'
import type { ArtKind } from './VehicleArt'

/**
 * Thin-line versions of the five vehicle drawings: outlines only, no fills, so they sit quietly on the surface in light
 * and dark with nothing to match against the background. One stroke width and the same silhouettes as the filled set, so
 * a vehicle is recognisably the same one in both.
 */
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/** A wheel as a tyre ring, a rim ring and a hub dot. */
const W = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <g {...S}>
    <circle cx={cx} cy={cy} r={r} />
    <circle cx={cx} cy={cy} r={r * 0.58} />
    <circle cx={cx} cy={cy} r={1.6} fill="currentColor" stroke="none" />
  </g>
)

const SHAPES: Record<ArtKind, { w: number; h: number; body: ReactElement }> = {
  car: {
    w: 220, h: 92,
    body: (
      <>
        {/* body outline; the sill stops at each wheel arch, and the arch is one clean curve around the tyre */}
        <path {...S} d="M12 70V56c0-5 3-8 8-9l24-5 26-20c3-2 6-3 10-3h46c5 0 9 1 12 4l24 19 22 4c6 1 10 5 10 11v13h-12" />
        <path {...S} d="M12 70h30M74 70h58M148 70h28" />
        <path {...S} d="M40 70a20 20 0 0 1 36 0M146 70a20 20 0 0 1 36 0" />
        {/* windows and a door line */}
        <path {...S} d="M78 41 96 26h18v15zM122 41V26h12l18 15z" />
        <path {...S} d="M118 41v26" />
        <W cx={58} cy={72} r={13} /><W cx={164} cy={72} r={13} />
      </>
    ),
  },
  pickup: {
    w: 240, h: 96,
    body: (
      <>
        <path {...S} d="M10 72V56c0-5 3-8 8-9l22-4 24-17c3-2 6-3 10-3h26c5 0 8 1 11 4l14 16h4V44h104c4 0 6 2 6 6v22h-12" />
        <path {...S} d="M10 72h30M88 72h74M232 72h-24" />
        <path {...S} d="M42 72a22 22 0 0 1 44 0M174 72a22 22 0 0 1 44 0" />
        {/* open bed: rear gate line and a floor line */}
        <path {...S} d="M122 56h110" />
        <path {...S} d="M62 42 78 28h22l10 14z" />
        <W cx={64} cy={74} r={14} /><W cx={196} cy={74} r={14} />
      </>
    ),
  },
  scooter: {
    w: 220, h: 100,
    body: (
      <>
        {/* rear body and seat */}
        <path {...S} d="M22 64c0-16 10-26 26-28l34-4c10-1 16 4 16 12v20" />
        <path {...S} d="M38 30c2-7 9-11 18-11h40c6 0 9 3 9 8v4H44c-3 0-5-1-6-1z" />
        {/* floorboard into the leg shield, handlebar and fork */}
        <path {...S} d="M98 66h38l12-44" />
        <path {...S} d="M136 66l8-26 10 6-6 20" />
        <path {...S} d="M138 14h26" />
        <path {...S} d="M150 22 168 74" />
        <path {...S} d="M156 62c8-6 20-6 28 2" />
        <W cx={50} cy={80} r={15} /><W cx={172} cy={80} r={13} />
      </>
    ),
  },
  motorcycle: {
    w: 220, h: 100,
    body: (
      <>
        {/* frame, swingarm, engine, tank and seat as outlines */}
        <path {...S} d="M50 80 84 52h34l22 28" />
        <path {...S} d="M84 52 62 38" />
        <path {...S} d="M88 52h34v22H98z" />
        <path {...S} d="M96 34c4-6 10-8 18-8h14c4 0 6 2 6 5l-2 9H96z" />
        <path {...S} d="M60 38c2-4 6-5 10-5h24l-4 9H62c-3 0-4-2-2-4z" />
        {/* fork and bars */}
        <path {...S} d="M144 32 170 80" />
        <path {...S} d="M138 26h16" />
        <W cx={50} cy={80} r={18} /><W cx={170} cy={80} r={18} />
      </>
    ),
  },
  bigbike: {
    w: 240, h: 104,
    body: (
      <>
        <path {...S} d="M54 84 92 58h42l24 26" />
        <path {...S} d="M90 58h46v26H104z" />
        <path {...S} d="M58 92h66" />
        <path {...S} d="M98 36c5-9 14-12 26-12h20c7 0 10 4 10 9l-4 14H96z" />
        <path {...S} d="M56 44c3-6 9-8 15-8h26l-6 14H58c-5 0-6-3-2-6z" />
        {/* fairing, screen and fork */}
        <path {...S} d="M150 46c0-8 6-18 18-26l16 8-10 18z" />
        <path {...S} d="M170 22l16 6" />
        <path {...S} d="M160 42 188 84" />
        <W cx={54} cy={84} r={20} /><W cx={188} cy={84} r={20} />
      </>
    ),
  },
}

/** The thin-line drawing of a vehicle. Decorative: the vehicle's name is always written beside it. */
export function VehicleLine({ kind, className = '', style }: { kind: ArtKind; className?: string; style?: CSSProperties }) {
  const s = SHAPES[kind]
  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} className={className} style={style} aria-hidden focusable="false" role="presentation">
      {s.body}
    </svg>
  )
}
