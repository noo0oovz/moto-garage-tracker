import {
  Battery, CircleDot, Cog, Cylinder, Disc3, Droplet, Droplets, Filter, Fuel, Link2, Orbit, Snowflake, Spline, Thermometer,
  Waves, Wind, Wrench, Zap, CloudRain, type LucideIcon,
} from 'lucide-react'
import type { GuideKey } from './intervals'

/**
 * One icon per thing that wears out, so an overdue oil change and an overdue belt look different at a glance.
 * Every guide key must be listed here (a test enforces it); items the owner added by hand fall back to a spanner.
 */
export const PART_ICON: Record<GuideKey, LucideIcon> = {
  'engine-oil': Droplet,
  'oil-filter': Filter,
  'air-filter': Wind,
  'cabin-filter': Wind,
  'ac-clean': Snowflake,
  'fuel-filter': Fuel,
  'spark-plugs': Zap,
  'coolant': Thermometer,
  'brake-fluid': Droplets,
  'brake-pads': Disc3,
  'brake-pads-moto': Disc3,
  'tires': CircleDot,
  'battery': Battery,
  'drive-belt': Spline,
  'timing-belt': Spline,
  'trans-manual': Cog,
  'trans-auto': Cog,
  'trans-cvt': Cog,
  'trans-dct': Cog,
  'diff-4x4': Cog,
  'wipers': CloudRain,
  'cvt-belt': Spline,
  'cvt-rollers': Orbit,
  'gear-oil': Droplets,
  'chain': Link2,
  'valve-clearance': Cylinder,
  'fork-oil': Waves,
}

/** Short names for the tile caption and for screen readers. */
export const PART_LABEL: Record<GuideKey, string> = {
  'engine-oil': 'Engine oil', 'oil-filter': 'Oil filter', 'air-filter': 'Air filter', 'cabin-filter': 'Cabin filter', 'ac-clean': 'A/C',
  'fuel-filter': 'Fuel filter', 'spark-plugs': 'Spark plugs', 'coolant': 'Coolant', 'brake-fluid': 'Brake fluid', 'brake-pads': 'Brakes',
  'brake-pads-moto': 'Brakes', 'tires': 'Tires', 'battery': 'Battery', 'drive-belt': 'Drive belt', 'timing-belt': 'Timing belt',
  'trans-manual': 'Gearbox oil', 'trans-auto': 'Gearbox fluid', 'trans-cvt': 'CVT fluid', 'trans-dct': 'Gearbox fluid', 'diff-4x4': 'Differential',
  'wipers': 'Wipers', 'cvt-belt': 'CVT belt', 'cvt-rollers': 'CVT rollers', 'gear-oil': 'Gear oil', 'chain': 'Chain',
  'valve-clearance': 'Valves', 'fork-oil': 'Fork oil',
}

const isKey = (k: string | undefined): k is GuideKey => !!k && Object.prototype.hasOwnProperty.call(PART_ICON, k)

/**
 * Which icon an item gets when it has no guide key (sample data, older items, ones typed in by hand). First match wins, so
 * the specific rules sit before the general ones: "Engine Oil & Oil Filter" is oil, not a filter.
 */
const BY_NAME: { test: RegExp; key: GuideKey }[] = [
  { test: /cvt.*(belt|roller)|roller/i, key: 'cvt-rollers' },
  { test: /engine\s*oil|oil\s*change|langis/i, key: 'engine-oil' },
  { test: /oil\s*filter|strainer/i, key: 'oil-filter' },
  { test: /spark\s*plug/i, key: 'spark-plugs' },
  { test: /fuel\s*filter/i, key: 'fuel-filter' },
  { test: /cabin|a\/c|aircon/i, key: 'cabin-filter' },
  { test: /air.*filter|engine\s*air/i, key: 'air-filter' },
  { test: /brake.*fluid|fluid.*brake/i, key: 'brake-fluid' },
  { test: /brake|pads?|shoes?/i, key: 'brake-pads' },
  { test: /tire|tyre|wheel|rotation|alignment|gulong/i, key: 'tires' },
  { test: /battery/i, key: 'battery' },
  { test: /coolant|radiator/i, key: 'coolant' },
  { test: /timing\s*belt|drive\s*belt|belt/i, key: 'drive-belt' },
  { test: /fork|steering/i, key: 'fork-oil' },
  { test: /chain|sprocket/i, key: 'chain' },
  { test: /valve/i, key: 'valve-clearance' },
  { test: /transmission|gear\s*oil|differential|cvt|atf/i, key: 'trans-auto' },
  { test: /wiper/i, key: 'wipers' },
]

/**
 * The icon key for an item: its own guide key if it has one, otherwise a guess from its name, otherwise none.
 * When a name lists several parts ("Air Filter & Spark Plug") the one named FIRST wins, as that is how the owner reads it.
 * Ties at the same position go to the earlier, more specific rule.
 */
export function partKeyFor(item: { guideKey?: string; name?: string }): GuideKey | undefined {
  if (isKey(item.guideKey)) return item.guideKey
  const name = typeof item.name === 'string' ? item.name : ''
  let best: { at: number; key: GuideKey } | undefined
  for (const r of BY_NAME) {
    const at = name.search(r.test)
    if (at >= 0 && (!best || at < best.at)) best = { at, key: r.key }
  }
  return best?.key
}

export type PartTone = 'ok' | 'soon' | 'over' | 'check'

const TONE_STYLE: Record<PartTone, { bg: string; fg: string }> = {
  ok: { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  soon: { bg: 'var(--soon-bg)', fg: 'var(--soon)' },
  over: { bg: 'var(--over-bg)', fg: 'var(--over)' },
  check: { bg: 'var(--surface-2)', fg: 'var(--text-2)' },
}

/**
 * A rounded tile holding the part's icon, tinted by its status. The tile is decorative: status is always also stated in
 * words next to it, so colour is never the only signal.
 */
export function PartIcon({ item, tone = 'check', size = 40, round = false }: { item: { guideKey?: string; name?: string }; tone?: PartTone; size?: number; round?: boolean }) {
  const key = partKeyFor(item)
  const Icon = key ? PART_ICON[key] : Wrench
  const t = TONE_STYLE[tone]
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: size, background: t.bg, color: t.fg, borderRadius: round ? '50%' : size * 0.3 }} aria-hidden>
      <Icon size={size * 0.5} strokeWidth={1.9} />
    </span>
  )
}
