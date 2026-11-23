// General maintenance guidance by vehicle class.
//
// IMPORTANT: these numbers are NOT from any maker's manual. Manuals are copyrighted, were not reachable, and differ by
// model. They are conservative, widely published rules of thumb, and where makers genuinely differ the SHORTER
// interval is used, so being wrong errs towards servicing early rather than late. Every item is labelled "general
// guidance" in the UI, and the owner can replace any interval with the number from her own casa booklet.
//
// All the numbers live in the tables in this file so a mechanic or the owner can review and correct them in one place.
import type { BikeType, DrivingConditions, FuelType, Transmission, Vehicle } from './types'

export type GuideKey =
  | 'engine-oil' | 'oil-filter' | 'air-filter' | 'cabin-filter' | 'ac-clean' | 'fuel-filter' | 'spark-plugs'
  | 'coolant' | 'brake-fluid' | 'brake-pads' | 'tires' | 'battery' | 'drive-belt' | 'timing-belt'
  | 'trans-manual' | 'trans-auto' | 'trans-cvt' | 'trans-dct' | 'diff-4x4' | 'wipers'
  | 'cvt-belt' | 'cvt-rollers' | 'gear-oil' | 'chain' | 'valve-clearance' | 'fork-oil' | 'brake-pads-moto'

export interface GuideEntry {
  key: GuideKey
  name: string
  /** Plain language: what it does and what goes wrong if it is skipped. Written for someone who is not a mechanic. */
  why: string
  /** Base interval before any severe-use adjustment. At least one of km / months is set. */
  km?: number
  months?: number
  /** Which severe-use conditions shorten this item (each applies the factor below). */
  severe?: (keyof DrivingConditions)[]
}

export interface PlanItem {
  key: GuideKey
  name: string
  intervalKm?: number
  intervalMonths?: number
  why: string
  /** Set when severe driving conditions shortened this item, and why. */
  adjusted?: string
  source: 'general'
}

/** How much a severe-use condition shortens an interval. 0.75 = 25% sooner. Several conditions never go below the floor. */
export const SEVERE_FACTOR = 0.75
export const SEVERE_FLOOR = 0.5

const CONDITION_LABEL: Record<keyof DrivingConditions, string> = {
  heavyTraffic: 'heavy traffic', shortTrips: 'short trips', dusty: 'dusty roads', towing: 'towing or heavy loads',
}

// ---- The guide: each thing that wears out, what it does, and the base interval -----------------------------------
const G = (e: GuideEntry) => e
export const GUIDE: Record<GuideKey, GuideEntry> = {
  'engine-oil': G({ key: 'engine-oil', name: 'Engine oil change', km: 5000, months: 6, severe: ['heavyTraffic', 'shortTrips', 'dusty', 'towing'],
    why: 'Oil carries dirt and heat away from the engine. Old oil turns to sludge and wears the engine down. It is the cheapest and most important service.' }),
  'oil-filter': G({ key: 'oil-filter', name: 'Oil filter', km: 5000, months: 6, severe: ['heavyTraffic', 'shortTrips', 'dusty', 'towing'],
    why: 'Catches the dirt in the oil. Change it with every oil change, or the new oil gets dirty right away.' }),
  'air-filter': G({ key: 'air-filter', name: 'Engine air filter', km: 15000, months: 12, severe: ['dusty', 'heavyTraffic'],
    why: 'Stops dust from entering the engine. A clogged one makes the engine use more fuel and lose power.' }),
  'cabin-filter': G({ key: 'cabin-filter', name: 'Cabin / A/C filter', km: 15000, months: 12, severe: ['dusty', 'heavyTraffic'],
    why: 'Cleans the air you breathe inside the car. A dirty one makes the A/C weak and smelly, and the air bad to breathe.' }),
  'ac-clean': G({ key: 'ac-clean', name: 'A/C cleaning (evaporator)', months: 12,
    why: 'Mould and dirt build up inside the A/C. Cleaning removes the bad smell and helps it cool properly.' }),
  'fuel-filter': G({ key: 'fuel-filter', name: 'Fuel filter', km: 20000, months: 24, severe: ['dusty'],
    why: 'Keeps dirt and water out of the fuel system. Clogged ones cause rough running and hard starts, and can damage the injectors.' }),
  'spark-plugs': G({ key: 'spark-plugs', name: 'Spark plugs', km: 20000, months: 24,
    why: 'They ignite the fuel. Worn plugs cause hard starting, rough running and wasted fuel. (Long-life iridium plugs last longer, so check your booklet.)' }),
  'coolant': G({ key: 'coolant', name: 'Coolant / radiator flush', km: 40000, months: 24,
    why: 'Keeps the engine from overheating and rusting inside. Old coolant stops protecting, and an overheated engine is a very expensive repair.' }),
  'brake-fluid': G({ key: 'brake-fluid', name: 'Brake fluid', months: 24,
    why: 'Brake fluid absorbs water over time, which makes brakes feel soft and can make them fail under heavy braking. It ages even if you barely drive, so it is time-based.' }),
  'brake-pads': G({ key: 'brake-pads', name: 'Brake pads & shoes check', km: 20000, months: 12, severe: ['heavyTraffic', 'towing'],
    why: 'Pads wear down every time you brake. Worn pads damage the discs and take longer to stop. Have them measured, and replaced when thin.' }),
  'tires': G({ key: 'tires', name: 'Tires: rotation, balance & alignment', km: 10000, months: 6,
    why: 'Rotating the tires makes them wear evenly and last longer. Old or worn tires grip badly in the rain. Check for cracks, even if the tread looks fine.' }),
  'battery': G({ key: 'battery', name: 'Battery check', months: 24,
    why: 'Batteries usually last 2 to 4 years in our heat. Testing it before it dies saves you from being stranded.' }),
  'drive-belt': G({ key: 'drive-belt', name: 'Drive belt inspection', km: 40000, months: 36,
    why: 'Runs the alternator, power steering and A/C. If it snaps you lose them all at once.' }),
  'timing-belt': G({ key: 'timing-belt', name: 'Timing belt (if your engine has one)', km: 80000, months: 60,
    why: 'Keeps the engine parts in step. If it snaps the engine can be destroyed, so replace it on time. Some engines use a chain instead, so check your booklet.' }),
  'trans-manual': G({ key: 'trans-manual', name: 'Manual transmission oil', km: 40000, months: 36, severe: ['towing', 'heavyTraffic'],
    why: 'Lubricates the gears. Old oil makes shifting rough and wears the gears.' }),
  'trans-auto': G({ key: 'trans-auto', name: 'Automatic transmission fluid', km: 40000, months: 36, severe: ['towing', 'heavyTraffic'],
    why: 'Cools and lubricates the automatic gearbox. Many people never change it, then the gearbox fails, which is a very costly repair. Fresh fluid is cheap insurance.' }),
  'trans-cvt': G({ key: 'trans-cvt', name: 'CVT transmission fluid', km: 40000, months: 36, severe: ['towing', 'heavyTraffic'],
    why: 'A CVT needs its own special fluid. Wrong or old fluid damages the belt. Use the type your vehicle needs and change it on time.' }),
  'trans-dct': G({ key: 'trans-dct', name: 'Dual-clutch transmission fluid', km: 40000, months: 36, severe: ['towing', 'heavyTraffic'],
    why: 'Dual-clutch gearboxes are sensitive to old fluid. Have it done by someone who knows your gearbox.' }),
  'diff-4x4': G({ key: 'diff-4x4', name: 'Differential / transfer case oil', km: 40000, months: 36, severe: ['towing', 'dusty'],
    why: 'Lubricates the gears that send power to the wheels. Needed for 4x4 and rear-drive trucks. Old oil wears them out.' }),
  'wipers': G({ key: 'wipers', name: 'Wiper blades', months: 12,
    why: 'Rubber hardens in the sun and rain. Worn wipers smear the glass and make driving in a storm dangerous.' }),
  // ---- motorcycles ----
  'cvt-belt': G({ key: 'cvt-belt', name: 'CVT drive belt (scooter)', km: 20000, months: 24, severe: ['heavyTraffic', 'dusty'],
    why: 'On a scooter this belt moves the rear wheel. If it snaps you stop. Heavy traffic and carrying a passenger wear it faster.' }),
  'cvt-rollers': G({ key: 'cvt-rollers', name: 'CVT rollers & clutch (scooter)', km: 20000, months: 24, severe: ['heavyTraffic'],
    why: 'Worn rollers make the scooter feel slow, shake, or jerk when you accelerate.' }),
  'gear-oil': G({ key: 'gear-oil', name: 'Gear / transmission oil (scooter)', km: 6000, months: 12,
    why: 'Lubricates the final gears on a scooter. It is small, cheap, and easy to forget.' }),
  'chain': G({ key: 'chain', name: 'Chain: clean, lube & slack check', km: 500, months: 1, severe: ['dusty'],
    why: 'A dry or loose chain wears out fast and can snap or jump. Cleaning and lubing it every few weeks makes the chain and sprockets last far longer.' }),
  'valve-clearance': G({ key: 'valve-clearance', name: 'Valve clearance check', km: 12000, months: 12,
    why: 'Valves that are too tight or loose cause hard starting and lost power. A quick check by a mechanic, not a part to replace.' }),
  'fork-oil': G({ key: 'fork-oil', name: 'Front fork oil & steering bearings', km: 20000, months: 24,
    why: 'Keeps the front suspension soft and the steering smooth. Old fork oil makes the ride harsh and braking less stable.' }),
  'brake-pads-moto': G({ key: 'brake-pads-moto', name: 'Brake pads / shoes check', km: 8000, months: 12, severe: ['heavyTraffic'],
    why: 'Brake pads and shoes wear down every time you brake. Check them often: your brakes are what keep you alive on a motorcycle.' }),
}

// ---- Vehicle classes ---------------------------------------------------------------------------------------------
export type VehicleClass =
  | 'car-gasoline' | 'car-diesel' | 'car-hybrid' | 'car-ev'
  | 'moto-scooter-125' | 'moto-125' | 'moto-150' | 'moto-250-400' | 'moto-big'

/** Motorcycle class from engine size. Scooters (CVT) are identified separately by the transmission. */
export function motoClass(engineCc: number | undefined, scooter: boolean): VehicleClass {
  const cc = engineCc && Number.isFinite(engineCc) && engineCc > 0 ? engineCc : 125 // unknown: treat as the common small bike
  if (cc <= 125) return scooter ? 'moto-scooter-125' : 'moto-125'
  if (cc <= 160) return scooter ? 'moto-scooter-125' : 'moto-150' // 150-160cc scooters (Click 160, Aerox, NMAX 155) share the scooter set
  if (cc <= 400) return 'moto-250-400'
  return 'moto-big'
}

/** The maintenance class a chosen bike type maps to. Small bikes split by size: about 125cc and under vs 150-160cc. */
export function classForBikeType(t: BikeType, engineCc?: number): VehicleClass {
  if (t === 'scooter') return engineCc && engineCc > 160 ? 'moto-250-400' : 'moto-scooter-125'
  if (t === 'mid') return 'moto-250-400'
  if (t === 'big') return 'moto-big'
  return engineCc && engineCc > 125 ? 'moto-150' : 'moto-125'
}

/**
 * A motorcycle's class comes from the type the owner chose. Vehicles saved before that question existed have no type,
 * so they fall back to engine size and gearbox as before.
 */
export function classOf(v: Pick<Vehicle, 'type' | 'fuelType' | 'engineCc' | 'transmission'> & Partial<Pick<Vehicle, 'bikeType'>>): VehicleClass {
  if (v.type === 'motorcycle') {
    return v.bikeType ? classForBikeType(v.bikeType, v.engineCc) : motoClass(v.engineCc, v.transmission === 'cvt' || v.transmission === 'automatic')
  }
  const f: FuelType = v.fuelType
  return f === 'Diesel' ? 'car-diesel' : f === 'Hybrid' ? 'car-hybrid' : f === 'EV' ? 'car-ev' : 'car-gasoline'
}

const CAR_COMMON: GuideKey[] = ['engine-oil', 'oil-filter', 'air-filter', 'cabin-filter', 'ac-clean', 'brake-fluid', 'brake-pads', 'tires', 'battery', 'coolant', 'drive-belt', 'wipers']

/** Which guide items apply to which class, in the order the owner will see them. */
const ITEMS_BY_CLASS: Record<VehicleClass, GuideKey[]> = {
  'car-gasoline': [...CAR_COMMON, 'spark-plugs', 'fuel-filter'],
  'car-diesel': [...CAR_COMMON, 'fuel-filter', 'timing-belt'],
  'car-hybrid': [...CAR_COMMON, 'spark-plugs'],
  'car-ev': ['cabin-filter', 'ac-clean', 'brake-fluid', 'brake-pads', 'tires', 'battery', 'coolant', 'wipers'],
  'moto-scooter-125': ['engine-oil', 'gear-oil', 'air-filter', 'spark-plugs', 'cvt-belt', 'cvt-rollers', 'brake-pads-moto', 'brake-fluid', 'tires', 'battery'],
  'moto-125': ['engine-oil', 'chain', 'air-filter', 'spark-plugs', 'valve-clearance', 'brake-pads-moto', 'brake-fluid', 'tires', 'battery'],
  'moto-150': ['engine-oil', 'chain', 'air-filter', 'spark-plugs', 'valve-clearance', 'brake-pads-moto', 'brake-fluid', 'fork-oil', 'tires', 'battery'],
  'moto-250-400': ['engine-oil', 'oil-filter', 'chain', 'air-filter', 'spark-plugs', 'valve-clearance', 'coolant', 'brake-pads-moto', 'brake-fluid', 'fork-oil', 'tires', 'battery'],
  'moto-big': ['engine-oil', 'oil-filter', 'chain', 'air-filter', 'spark-plugs', 'valve-clearance', 'coolant', 'brake-pads-moto', 'brake-fluid', 'fork-oil', 'tires', 'battery'],
}

/**
 * Per-class overrides to the base interval. Bigger bikes use more oil and tolerate longer intervals; small scooters
 * and 125cc bikes work harder per cc and want oil sooner.
 */
const CLASS_OVERRIDE: Partial<Record<VehicleClass, Partial<Record<GuideKey, { km?: number; months?: number }>>>> = {
  'car-diesel': { 'engine-oil': { km: 5000, months: 6 }, 'oil-filter': { km: 5000, months: 6 }, 'air-filter': { km: 15000, months: 12 }, 'fuel-filter': { km: 10000, months: 12 } },
  'moto-scooter-125': { 'engine-oil': { km: 2000, months: 3 }, 'air-filter': { km: 6000, months: 6 }, 'spark-plugs': { km: 8000, months: 12 }, 'brake-pads-moto': { km: 8000, months: 12 } },
  'moto-125': { 'engine-oil': { km: 2000, months: 3 }, 'air-filter': { km: 6000, months: 6 }, 'spark-plugs': { km: 8000, months: 12 } },
  'moto-150': { 'engine-oil': { km: 2000, months: 3 }, 'air-filter': { km: 6000, months: 6 }, 'spark-plugs': { km: 8000, months: 12 } },
  'moto-250-400': { 'engine-oil': { km: 4000, months: 6 }, 'oil-filter': { km: 4000, months: 6 }, 'air-filter': { km: 10000, months: 12 }, 'spark-plugs': { km: 12000, months: 18 }, 'valve-clearance': { km: 12000, months: 12 } },
  'moto-big': { 'engine-oil': { km: 6000, months: 6 }, 'oil-filter': { km: 6000, months: 6 }, 'air-filter': { km: 10000, months: 12 }, 'spark-plugs': { km: 16000, months: 24 }, 'valve-clearance': { km: 24000, months: 24 } },
}

function transKey(t: Transmission | undefined): GuideKey {
  return t === 'manual' ? 'trans-manual' : t === 'cvt' ? 'trans-cvt' : t === 'dct' ? 'trans-dct' : 'trans-auto'
}

/** The number of severe-use conditions that apply to a given item. */
function severeHits(entry: GuideEntry, d: DrivingConditions | undefined): (keyof DrivingConditions)[] {
  if (!d || !entry.severe) return []
  return entry.severe.filter((c) => d[c])
}

/** Round a shortened interval to a sensible number (nearest 500 km, whole months) and never below 1. */
const roundKm = (n: number) => Math.max(500, Math.round(n / 500) * 500)
const roundMo = (n: number) => Math.max(1, Math.round(n))

/**
 * The suggested maintenance plan for a vehicle: only items that exist for its class, with intervals shortened for
 * severe use and a plain reason for each. Never empty and never throws: unknown inputs fall back to a general plan.
 */
export function planFor(v: Pick<Vehicle, 'type' | 'fuelType' | 'engineCc' | 'transmission' | 'driving'> & Partial<Pick<Vehicle, 'bikeType'>>): PlanItem[] {
  const cls = classOf(v)
  const keys = [...ITEMS_BY_CLASS[cls]]
  // Cars with a gearbox: add the transmission item that matches it (EVs have none; the diesel/gasoline default is automatic).
  if (cls.startsWith('car-') && cls !== 'car-ev') {
    const at = keys.indexOf('brake-fluid')
    keys.splice(at >= 0 ? at : keys.length, 0, transKey(v.transmission))
  }
  return keys.map((key) => {
    const base = GUIDE[key]
    const over = CLASS_OVERRIDE[cls]?.[key]
    let km = over?.km ?? base.km
    let months = over?.months ?? base.months
    const hits = severeHits(base, v.driving)
    let adjusted: string | undefined
    if (hits.length) {
      const factor = Math.max(SEVERE_FLOOR, Math.pow(SEVERE_FACTOR, hits.length))
      if (km !== undefined) km = roundKm(km * factor)
      if (months !== undefined) months = roundMo(months * factor)
      const label = (h: keyof DrivingConditions) => (h === 'towing' && v.type === 'motorcycle' ? 'carrying a passenger or cargo' : CONDITION_LABEL[h])
      adjusted = `Shortened because of ${hits.map(label).join(' and ')}.`
    }
    return { key, name: base.name, intervalKm: km, intervalMonths: months, why: base.why, adjusted, source: 'general' as const }
  })
}

// ---- Recognising items the owner already tracks ----------------------------------------------------------------
/**
 * Items created before this guide existed (the original starter lists, or ones typed by hand) have no guide key, and
 * their names differ from the guide's ("Engine Oil & Oil Filter" vs "Engine oil change"). Setup must not offer a second
 * copy of something that is already tracked, so each old name claims the guide entries it covers. Matching is by
 * keywords in the name, which also catches hand-typed names like "oil change" or "Pagpalit ng langis".
 */
const COVERS: { test: RegExp; keys: GuideKey[] }[] = [
  // oil: "Engine Oil & Oil Filter", "Engine Oil & Strainer/Filter", "oil change", "Pagpalit ng langis"
  { test: /engine\s*oil|oil\s*change|change\s*oil|langis/i, keys: ['engine-oil'] },
  { test: /oil\s*(&|and)?\s*(oil\s*)?(filter|strainer)|oil\s*filter|strainer/i, keys: ['oil-filter'] },
  // filters
  { test: /air\s*(&|and)?\s*(cabin|a\/?c)?\s*(a\/?c\s*)?filter|air\s*filter|engine\s*air/i, keys: ['air-filter'] },
  { test: /cabin|a\/c\s*filter|aircon|a\/c\s*clean/i, keys: ['cabin-filter', 'ac-clean'] },
  { test: /fuel\s*filter/i, keys: ['fuel-filter'] },
  { test: /spark\s*plug/i, keys: ['spark-plugs'] },
  // cooling, brakes, tires, battery
  { test: /coolant|radiator/i, keys: ['coolant'] },
  { test: /brake.*fluid|fluid.*brake|brake\s*pads?.*&.*fluid/i, keys: ['brake-fluid'] },
  { test: /brake\s*(pads?|shoes?)|rear\s*shoes?/i, keys: ['brake-pads', 'brake-pads-moto'] },
  { test: /tire|tyre|rotation|alignment|gulong/i, keys: ['tires'] },
  { test: /battery/i, keys: ['battery'] },
  // belts
  { test: /timing\s*belt/i, keys: ['timing-belt'] },
  { test: /drive\s*belt|belt\s*inspection/i, keys: ['drive-belt'] },
  // transmission, differential, gear oil
  { test: /transmission|tranny|gear\s*oil|differential|cvt\s*(fluid|oil)|atf/i, keys: ['trans-manual', 'trans-auto', 'trans-cvt', 'trans-dct', 'diff-4x4', 'gear-oil'] },
  { test: /cvt.*(belt|roller)|roller/i, keys: ['cvt-belt', 'cvt-rollers'] },
  // motorcycle
  { test: /chain|sprocket/i, keys: ['chain'] },
  { test: /valve/i, keys: ['valve-clearance'] },
  { test: /fork|steering/i, keys: ['fork-oil'] },
  { test: /wiper/i, keys: ['wipers'] },
]

/** The set of guide keys an item already covers: its own key if it has one, otherwise whatever its name implies. */
export function keysCoveredBy(item: { name: string; guideKey?: string }): Set<GuideKey> {
  const out = new Set<GuideKey>()
  if (item.guideKey && item.guideKey in GUIDE) { out.add(item.guideKey as GuideKey); return out }
  for (const c of COVERS) if (c.test.test(item.name)) c.keys.forEach((k) => out.add(k))
  return out
}

// ---- "When was this last done?" ----------------------------------------------------------------------------------
export type LastDone = 'just-done' | 'recent' | 'old' | 'never' | 'unknown'

export const LAST_DONE_LABEL: Record<LastDone, string> = {
  'just-done': 'Just done',
  'recent': 'Within 6 months',
  'old': 'Over a year ago',
  'never': 'Never done',
  'unknown': "I don't know",
}

export interface LastService { lastServiceDate: string; lastServiceKm: number; unknownLast: boolean; neverDone?: boolean }

const pad = (n: number) => String(n).padStart(2, '0')
function shiftDate(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(y, m - 1 - months, 1)
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(Math.min(d, last))}`
}

/**
 * Turn an easy answer into the dates the app needs. The mapping is deliberately cautious:
 *  - "just done" is today at the current odometer;
 *  - "within 6 months" assumes about 3 months and the matching distance (never more than we can justify);
 *  - "over a year ago" assumes about 14 months and the matching distance;
 *  - "never done" counts from when the vehicle was new (0 km), so it is due only once the vehicle has gone past the interval;
 *  - "I don't know" is NEVER treated as healthy: it is placed past the item's limit so it reads as due, and is flagged
 *    so the app can say "last service unknown" instead of pretending it knows.
 * `avgDailyKm` turns elapsed time into distance. The item's own limits decide how far back "unknown" goes.
 */
export function lastServiceFor(
  answer: LastDone, today: string, odometer: number, avgDailyKm: number,
  limits: { intervalKm?: number; intervalMonths?: number },
): LastService {
  const perMonth = Math.max(0, Number.isFinite(avgDailyKm) ? avgDailyKm : 0) * 30
  const back = (months: number): LastService => ({
    lastServiceDate: shiftDate(today, months),
    lastServiceKm: Math.max(0, Math.round(odometer - perMonth * months)),
    unknownLast: false,
  })
  if (answer === 'just-done') return { lastServiceDate: today, lastServiceKm: odometer, unknownLast: false }
  if (answer === 'recent') return back(3)
  if (answer === 'old') return back(14)
  // never: the owner KNOWS it has not been done since the vehicle was new, so count from new. A bike with 500 km on it is
  // not late for a 2,000 km service, but one with 40,000 km is. The date is when that odometer reading was probably
  // reached (capped at 20 years so a typo cannot reach back to the 1900s).
  if (answer === 'never') {
    const km = Number.isFinite(odometer) ? Math.max(0, odometer) : 0
    const monthsUsed = perMonth > 0 ? Math.min(240, Math.round(km / perMonth)) : 0
    return { lastServiceDate: shiftDate(today, monthsUsed), lastServiceKm: 0, unknownLast: false, neverDone: true }
  }
  // unknown: go back far enough that BOTH limits read as exceeded, so it is due however the owner drives
  const months = Math.max(limits.intervalMonths ?? 0, 12) + 1
  const km = limits.intervalKm ?? 0
  return {
    lastServiceDate: shiftDate(today, months),
    lastServiceKm: Math.max(0, Math.round(odometer - Math.max(perMonth * months, km * 1.05))),
    unknownLast: true,
  }
}
