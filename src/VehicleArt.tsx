import type { CSSProperties, ReactElement } from 'react'
import type { BikeType, Vehicle } from './types'

/**
 * Side-view illustrations built from simple parts (wheels, a frame, a tank, a seat) in one colour (currentColor), so
 * they sit on the theme in light and dark and need no image files. Five shapes follow how the app already sorts
 * vehicles: a car, a pickup, a scooter, a geared motorcycle and a big bike.
 *
 * Built from primitives on purpose: strokes and simple shapes read as the right vehicle far more reliably than one
 * hand-traced outline does.
 */
export type ArtKind = 'car' | 'pickup' | 'scooter' | 'motorcycle' | 'bigbike'

/** Which illustration suits a vehicle. A pickup is recognised by model name, since the app only stores "car". */
export function artKind(v: Pick<Vehicle, 'type' | 'model' | 'make' | 'nickname'> & Partial<Pick<Vehicle, 'bikeType' | 'transmission' | 'engineCc'>>): ArtKind {
  if (v.type === 'motorcycle') {
    const t: BikeType | undefined = v.bikeType
    if (t) return t === 'scooter' ? 'scooter' : t === 'big' || t === 'mid' ? 'bigbike' : 'motorcycle'
    // Saved before the bike-type question: the gearbox says whether it is a scooter, the engine size how big.
    if (v.transmission === 'cvt' || v.transmission === 'automatic') return 'scooter'
    return v.engineCc && v.engineCc > 160 ? 'bigbike' : 'motorcycle'
  }
  return /hilux|ranger|navara|strada|d-?max|l200|triton|pickup|pick-up|f-?150|tacoma|colorado/i.test(`${v.make} ${v.model} ${v.nickname}`) ? 'pickup' : 'car'
}

const CUT = 'var(--art-cut, var(--surface))'

/** A wheel: tyre, a lighter inner disc and a hub, so it reads as a wheel and not a dot. */
const Wheel = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="currentColor" />
    <circle cx={cx} cy={cy} r={r * 0.55} fill={CUT} />
    <circle cx={cx} cy={cy} r={r * 0.2} fill="currentColor" />
  </g>
)

const stroke = (w: number) => ({ fill: 'none', stroke: 'currentColor', strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

const SHAPES: Record<ArtKind, { w: number; h: number; body: ReactElement }> = {
  car: {
    w: 220, h: 92,
    body: (
      <>
        {/* body: low hood, cabin with sloped windscreen and rear, flat sills */}
        <path d="M12 68V56c0-5 3-8 8-9l24-5 26-20c3-2 6-3 10-3h46c5 0 9 1 12 4l24 19 22 4c6 1 10 5 10 11v11z" fill="currentColor" />
        {/* windows */}
        <path d="M78 41 96 26h18v15zM122 41V26h12l18 15z" fill={CUT} />
        <path d="M12 68h196" {...stroke(0)} />
        <Wheel cx={58} cy={70} r={16} /><Wheel cx={164} cy={70} r={16} />
      </>
    ),
  },
  pickup: {
    w: 240, h: 96,
    body: (
      <>
        {/* cab (left) with a slanted windscreen, then an open load bed (right) */}
        <path d="M10 70V56c0-5 3-8 8-9l22-4 24-17c3-2 6-3 10-3h26c5 0 8 1 11 4l14 16h4v33z" fill="currentColor" />
        <path d="M122 44h108c4 0 6 2 6 6v20H122z" fill="currentColor" />
        <path d="M126 44V38h106v6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M62 42 78 28h22l10 14z" fill={CUT} />
        <Wheel cx={64} cy={72} r={17} /><Wheel cx={196} cy={72} r={17} />
      </>
    ),
  },
  scooter: {
    w: 220, h: 100,
    body: (
      <>
        {/* rear body: a rounded bulge over the back wheel, with the seat on top */}
        <path d="M22 62c0-16 10-26 26-28l34-4c10-1 16 4 16 12v22z" fill="currentColor" />
        <path d="M40 30c2-7 9-11 18-11h40c6 0 9 3 9 8v5H44c-3 0-5-1-4-2z" fill="currentColor" />
        {/* flat floorboard, running forward into the tall front leg shield */}
        <path d="M96 66h40" {...stroke(8)} />
        <path d="M134 66 148 22" {...stroke(10)} />
        {/* handlebar and mirror, and the fork down to the small front wheel */}
        <path d="M138 14h26" {...stroke(6)} />
        <path d="M150 20 160 32" {...stroke(5)} />
        <path d="M150 28 168 74" {...stroke(5)} />
        {/* front mudguard over the wheel */}
        <path d="M156 62c8-6 20-6 28 2" {...stroke(5)} />
        <Wheel cx={50} cy={78} r={16} /><Wheel cx={172} cy={78} r={14} />
      </>
    ),
  },
  motorcycle: {
    w: 220, h: 100,
    body: (
      <>
        {/* frame and swingarm */}
        <path d="M50 78 84 50h34l22 28" {...stroke(5)} />
        <path d="M84 50 62 36" {...stroke(5)} />
        {/* engine block */}
        <path d="M88 50h34v22H98z" fill="currentColor" />
        {/* tank, seat */}
        <path d="M96 32c4-6 10-8 18-8h14c4 0 6 2 6 5l-2 9H96z" fill="currentColor" />
        <path d="M60 36c2-4 6-5 10-5h24l-4 9H62c-3 0-4-2-2-4z" fill="currentColor" />
        {/* front forks and handlebar */}
        <path d="M144 30 168 78" {...stroke(5)} />
        <path d="M138 24h16" {...stroke(5)} />
        <path d="M151 34l8-8" {...stroke(0)} />
        <Wheel cx={50} cy={78} r={19} /><Wheel cx={170} cy={78} r={19} />
      </>
    ),
  },
  bigbike: {
    w: 240, h: 104,
    body: (
      <>
        {/* frame, big engine, exhaust */}
        <path d="M54 82 92 56h42l24 26" {...stroke(5)} />
        <path d="M90 56h46v26H104z" fill="currentColor" />
        <path d="M58 90h66" {...stroke(6)} />
        {/* tall fuel tank and a stepped seat with a tail */}
        <path d="M98 34c5-9 14-12 26-12h20c7 0 10 4 10 9l-4 14H96z" fill="currentColor" />
        <path d="M56 42c3-6 9-8 15-8h26l-6 14H58c-5 0-6-3-2-6z" fill="currentColor" />
        {/* front fairing with a raked screen, and forks */}
        <path d="M150 44c0-8 6-18 18-26l16 8-10 18z" fill="currentColor" />
        <path d="M170 20l16 6" {...stroke(5)} />
        <path d="M160 40 186 82" {...stroke(5)} />
        <Wheel cx={54} cy={82} r={21} /><Wheel cx={188} cy={82} r={21} />
      </>
    ),
  },
}

/** The illustration itself. Decorative: the vehicle's name is always written beside it. */
export function VehicleArt({ kind, className = '', style }: { kind: ArtKind; className?: string; style?: CSSProperties }) {
  const s = SHAPES[kind]
  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} className={className} style={style} aria-hidden focusable="false" role="presentation">
      {s.body}
    </svg>
  )
}

export const ART_KINDS = Object.keys(SHAPES) as ArtKind[]
