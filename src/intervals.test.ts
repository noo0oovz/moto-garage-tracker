import { describe, expect, it } from 'vitest'
import { GUIDE, SEVERE_FLOOR, classOf, keysCoveredBy, lastServiceFor, motoClass, planFor, type GuideKey, type LastDone } from './intervals'
import { maintHealth } from './logic'
import type { MaintItem, Vehicle } from './types'

const car = (o: Partial<Vehicle> = {}) => ({ type: 'car' as const, fuelType: 'Gasoline' as const, ...o })
const moto = (cc: number | undefined, o: Partial<Vehicle> = {}) => ({ type: 'motorcycle' as const, fuelType: 'Gasoline' as const, engineCc: cc, ...o })
const keys = (v: Parameters<typeof planFor>[0]) => planFor(v).map((i) => i.key)
const get = (v: Parameters<typeof planFor>[0], k: GuideKey) => planFor(v).find((i) => i.key === k)

describe('vehicle classes', () => {
  it('cars are classed by fuel type', () => {
    expect(classOf(car({ fuelType: 'Gasoline' }))).toBe('car-gasoline')
    expect(classOf(car({ fuelType: 'Diesel' }))).toBe('car-diesel')
    expect(classOf(car({ fuelType: 'Hybrid' }))).toBe('car-hybrid')
    expect(classOf(car({ fuelType: 'EV' }))).toBe('car-ev')
  })
  it('motorcycles cover 125cc up to big bikes', () => {
    expect(motoClass(110, false)).toBe('moto-125')
    expect(motoClass(125, false)).toBe('moto-125')
    expect(motoClass(150, false)).toBe('moto-150')
    expect(motoClass(160, false)).toBe('moto-150')
    expect(motoClass(250, false)).toBe('moto-250-400')
    expect(motoClass(400, false)).toBe('moto-250-400')
    expect(motoClass(401, false)).toBe('moto-big')
    expect(motoClass(650, false)).toBe('moto-big')
    expect(motoClass(1000, false)).toBe('moto-big')
  })
  it('scooters (CVT) get the scooter set at 125-160cc, but not at 250cc and up', () => {
    expect(motoClass(125, true)).toBe('moto-scooter-125')
    expect(motoClass(155, true)).toBe('moto-scooter-125') // NMAX / Aerox / Click 160 size
    expect(motoClass(300, true)).toBe('moto-250-400')
    expect(classOf(moto(155, { transmission: 'cvt' }))).toBe('moto-scooter-125')
    expect(classOf(moto(155, { transmission: 'manual' }))).toBe('moto-150')
  })
  it('unknown, zero, negative or NaN engine size falls back to the common small bike, never throws', () => {
    for (const cc of [undefined, 0, -5, NaN, Infinity]) expect(() => motoClass(cc as number, false), String(cc)).not.toThrow()
    expect(motoClass(undefined, false)).toBe('moto-125')
    expect(motoClass(NaN, false)).toBe('moto-125')
  })
})

describe('what each vehicle is asked to maintain', () => {
  it('a car gets oil, filters, A/C, transmission, coolant, brake fluid and battery', () => {
    const k = keys(car({ transmission: 'automatic' }))
    for (const need of ['engine-oil', 'oil-filter', 'air-filter', 'cabin-filter', 'ac-clean', 'trans-auto', 'coolant', 'brake-fluid', 'brake-pads', 'tires', 'battery'] as GuideKey[]) expect(k, need).toContain(need)
  })
  it('the transmission item matches the gearbox', () => {
    expect(keys(car({ transmission: 'manual' }))).toContain('trans-manual')
    expect(keys(car({ transmission: 'automatic' }))).toContain('trans-auto')
    expect(keys(car({ transmission: 'cvt' }))).toContain('trans-cvt')
    expect(keys(car({ transmission: 'dct' }))).toContain('trans-dct')
    for (const t of ['manual', 'cvt', 'dct'] as const) expect(keys(car({ transmission: t }))).not.toContain('trans-auto')
  })
  it('only one transmission item is ever offered', () => {
    for (const t of [undefined, 'manual', 'automatic', 'cvt', 'dct'] as const) {
      expect(keys(car({ transmission: t })).filter((k) => k.startsWith('trans-')).length, String(t)).toBe(1)
    }
  })
  it('an unknown gearbox is treated as automatic (the safer, costlier-to-skip case)', () => {
    expect(keys(car())).toContain('trans-auto')
  })
  it('diesel gets a fuel filter and timing belt check; gasoline gets spark plugs', () => {
    expect(keys(car({ fuelType: 'Diesel' }))).toEqual(expect.arrayContaining(['fuel-filter', 'timing-belt']))
    expect(keys(car({ fuelType: 'Diesel' }))).not.toContain('spark-plugs')
    expect(keys(car({ fuelType: 'Gasoline' }))).toContain('spark-plugs')
  })
  it('an EV gets no engine oil, spark plugs or transmission fluid', () => {
    const k = keys(car({ fuelType: 'EV' }))
    for (const no of ['engine-oil', 'oil-filter', 'spark-plugs', 'trans-auto', 'trans-manual', 'trans-cvt', 'timing-belt'] as GuideKey[]) expect(k, no).not.toContain(no)
    expect(k).toEqual(expect.arrayContaining(['brake-fluid', 'tires', 'battery', 'cabin-filter']))
  })
  it('a scooter gets CVT belt, rollers and gear oil but no chain', () => {
    const k = keys(moto(155, { transmission: 'cvt' }))
    expect(k).toEqual(expect.arrayContaining(['cvt-belt', 'cvt-rollers', 'gear-oil', 'engine-oil']))
    expect(k).not.toContain('chain')
  })
  it('a geared bike gets a chain but no CVT parts', () => {
    const k = keys(moto(150, { transmission: 'manual' }))
    expect(k).toContain('chain')
    for (const no of ['cvt-belt', 'cvt-rollers', 'gear-oil'] as GuideKey[]) expect(k).not.toContain(no)
  })
  it('bigger bikes get an oil filter, coolant, valve clearance and fork oil that small ones skip', () => {
    expect(keys(moto(125, { transmission: 'manual' }))).not.toContain('oil-filter')
    for (const cc of [250, 400, 650, 1000]) expect(keys(moto(cc, { transmission: 'manual' })), String(cc)).toEqual(expect.arrayContaining(['oil-filter', 'coolant', 'valve-clearance', 'fork-oil']))
  })
  it('bigger bikes get longer oil intervals than small ones (they hold more oil)', () => {
    const oil = (cc: number) => get(moto(cc, { transmission: 'manual' }), 'engine-oil')!.intervalKm!
    expect(oil(125)).toBeLessThan(oil(250))
    expect(oil(250)).toBeLessThan(oil(650))
  })
})

describe('every plan is sane', () => {
  const vehicles: Parameters<typeof planFor>[0][] = [
    car(), car({ fuelType: 'Diesel', transmission: 'manual' }), car({ fuelType: 'Hybrid', transmission: 'cvt' }), car({ fuelType: 'EV' }),
    moto(110), moto(125, { transmission: 'cvt' }), moto(150), moto(155, { transmission: 'cvt' }), moto(250), moto(400), moto(650), moto(1000), moto(undefined),
  ]
  it('is never empty, every item has a name, a reason, and at least one interval', () => {
    for (const v of vehicles) {
      const plan = planFor(v)
      expect(plan.length, JSON.stringify(v)).toBeGreaterThanOrEqual(7)
      for (const i of plan) {
        expect(i.name.length).toBeGreaterThan(2)
        expect(i.why.length, `${i.key} needs a plain-language reason`).toBeGreaterThan(30)
        expect(i.intervalKm !== undefined || i.intervalMonths !== undefined, `${i.key} needs an interval`).toBe(true)
        for (const n of [i.intervalKm, i.intervalMonths]) if (n !== undefined) expect(Number.isFinite(n) && n > 0, `${i.key}=${n}`).toBe(true)
        expect(i.source).toBe('general')
      }
    }
  })
  it('has no duplicate items', () => {
    for (const v of vehicles) { const k = keys(v); expect(new Set(k).size, JSON.stringify(v)).toBe(k.length) }
  })
  it('the guide is complete: every key has an entry whose key matches', () => {
    for (const [k, e] of Object.entries(GUIDE)) { expect(e.key).toBe(k); expect(e.km !== undefined || e.months !== undefined, k).toBe(true) }
  })
  it('brake fluid is time-based (it ages even if the vehicle is barely driven)', () => {
    expect(GUIDE['brake-fluid'].months).toBeDefined()
    expect(GUIDE['battery'].months).toBeDefined()
  })
})

describe('severe use only ever shortens', () => {
  const base = car({ transmission: 'automatic' })
  const all = { heavyTraffic: true, shortTrips: true, dusty: true, towing: true }
  it('never lengthens any interval, for any single condition or all of them', () => {
    const normal = planFor(base)
    for (const d of [{ heavyTraffic: true }, { shortTrips: true }, { dusty: true }, { towing: true }, all]) {
      const severe = planFor({ ...base, driving: d })
      for (const n of normal) {
        const s = severe.find((x) => x.key === n.key)!
        if (n.intervalKm !== undefined) expect(s.intervalKm!, `${n.key} km`).toBeLessThanOrEqual(n.intervalKm)
        if (n.intervalMonths !== undefined) expect(s.intervalMonths!, `${n.key} mo`).toBeLessThanOrEqual(n.intervalMonths)
      }
    }
  })
  it('shortens engine oil by the stated factor and says why', () => {
    const oil = get({ ...base, driving: { heavyTraffic: true } }, 'engine-oil')!
    expect(oil.intervalKm).toBe(4000) // 5000 * 0.75 = 3750, rounded to the nearest 500 -> 4000 (never lengthens: 4000 < 5000)
    expect(oil.adjusted).toMatch(/heavy traffic/)
  })
  it('does not touch items that severe use does not affect', () => {
    const n = get(base, 'brake-fluid')!; const s = get({ ...base, driving: all }, 'brake-fluid')!
    expect(s.intervalMonths).toBe(n.intervalMonths)
    expect(s.adjusted).toBeUndefined()
  })
  it('combined conditions are floored, never below half the interval', () => {
    const n = get(base, 'engine-oil')!; const s = get({ ...base, driving: all }, 'engine-oil')!
    expect(s.intervalKm!).toBeGreaterThanOrEqual(Math.floor(n.intervalKm! * SEVERE_FLOOR))
    expect(s.intervalKm!).toBeGreaterThan(0)
  })
  it('a driving object with all false changes nothing', () => {
    expect(planFor({ ...base, driving: { heavyTraffic: false, dusty: false } })).toEqual(planFor(base))
  })
  it('a chain stays at 500 km minimum however many conditions apply', () => {
    const c = get(moto(150, { transmission: 'manual', driving: all }), 'chain')!
    expect(c.intervalKm!).toBeGreaterThanOrEqual(500)
    expect(c.intervalMonths!).toBeGreaterThanOrEqual(1)
  })
})

describe('"when was this last done?" never reports unknown history as healthy', () => {
  const today = '2026-11-23'
  const item = (km?: number, months?: number): Pick<MaintItem, 'intervalKm' | 'intervalMonths'> => ({ intervalKm: km, intervalMonths: months })
  const status = (answer: LastDone, km: number | undefined, months: number | undefined, odometer = 78400, daily = 35) => {
    const l = lastServiceFor(answer, today, odometer, daily, { intervalKm: km, intervalMonths: months })
    const v = { odometer, avgDailyKm: daily } as Vehicle
    const m = { id: 'x', vehicleId: 'v', name: 'x', intervalKm: km, intervalMonths: months, lastServiceKm: l.lastServiceKm, lastServiceDate: l.lastServiceDate } as MaintItem
    return { l, h: maintHealth(m, v, today) }
  }
  it('"just done" is healthy and not flagged unknown', () => {
    const { l, h } = status('just-done', 5000, 6)
    expect(h.status).toBe('Healthy'); expect(l.unknownLast).toBe(false)
    expect(l.lastServiceDate).toBe(today); expect(l.lastServiceKm).toBe(78400)
  })
  it('"I don\'t know" is always overdue and flagged, for every kind of interval', () => {
    const cases: [number | undefined, number | undefined][] = [[5000, 6], [40000, 36], [500, 1], [undefined, 24], [20000, undefined], [80000, 60], [2000, 3]]
    for (const [km, mo] of cases) {
      const { l, h } = status('unknown', km, mo)
      expect(l.unknownLast, `${km}/${mo}`).toBe(true)
      expect(h.status, `unknown ${km}km/${mo}mo must not read healthy`).toBe('Overdue')
    }
  })
  it('"I don\'t know" is overdue even for someone who barely drives', () => {
    expect(status('unknown', 5000, 6, 78400, 0).h.status).toBe('Overdue') // 0 km/day: only the time limit can trip it
    expect(status('unknown', 5000, undefined, 78400, 0).h.status).toBe('Overdue') // km-only interval and no driving data
  })
  it('"I don\'t know" is overdue even when the odometer is small', () => {
    expect(status('unknown', 40000, 36, 1500, 30).h.status).toBe('Overdue')
    expect(status('unknown', 5000, 6, 0, 30).h.status).toBe('Overdue') // brand new car: only time can tell
  })
  it('"within 6 months" and "over a year ago" are real dates, not flagged unknown', () => {
    expect(status('recent', 5000, 6).l.unknownLast).toBe(false)
    expect(status('old', 5000, 6).l.unknownLast).toBe(false)
  })
  it('older answers are always worse than newer ones (monotonic)', () => {
    const rank = { Healthy: 0, 'Due Soon': 1, Overdue: 2 } as const
    const r = (a: LastDone) => status(a, 5000, 6).h.pct
    expect(r('just-done')).toBeLessThan(r('recent'))
    expect(r('recent')).toBeLessThan(r('old'))
    expect(r('old')).toBeLessThanOrEqual(r('unknown'))
    void rank
  })
  it('"over a year ago" is overdue for a 6-month item but not for a 36-month one', () => {
    expect(status('old', 5000, 6).h.status).toBe('Overdue')
    expect(status('old', 40000, 36).h.status).toBe('Healthy')
  })
  it('never produces a negative odometer or an invalid date', () => {
    for (const a of ['just-done', 'recent', 'old', 'unknown'] as LastDone[]) {
      for (const odo of [0, 500, 78400]) {
        const l = lastServiceFor(a, today, odo, 35, { intervalKm: 40000, intervalMonths: 36 })
        expect(l.lastServiceKm, `${a} ${odo}`).toBeGreaterThanOrEqual(0)
        expect(l.lastServiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(Number.isNaN(new Date(l.lastServiceDate).getTime())).toBe(false)
      }
    }
  })
  it('handles month-end dates (31st -> a shorter month)', () => {
    expect(lastServiceFor('recent', '2026-05-31', 10000, 30, item()).lastServiceDate).toBe('2026-02-28')
  })
  it('bad driving data (NaN, negative) does not break anything', () => {
    for (const d of [NaN, -10, Infinity]) expect(() => lastServiceFor('unknown', today, 1000, d, item(5000, 6)), String(d)).not.toThrow()
  })
})

describe('recognising items the owner already tracks (so setup never duplicates them)', () => {
  const covers = (name: string, guideKey?: string) => [...keysCoveredBy({ name, guideKey })].sort()
  const has = (name: string, ...want: GuideKey[]) => { const c = covers(name); for (const w of want) expect(c, `"${name}" should cover ${w}`).toContain(w) }
  const lacks = (name: string, ...no: GuideKey[]) => { const c = covers(name); for (const n of no) expect(c, `"${name}" should NOT cover ${n}`).not.toContain(n) }

  it('the original car starter list is recognised', () => {
    has('Engine Oil & Oil Filter', 'engine-oil', 'oil-filter')
    has('Fuel Filter & Water Separator Check', 'fuel-filter')
    has('Engine Air & Cabin A/C Filter', 'air-filter', 'cabin-filter')
    has('Tire Rotation & Alignment Check', 'tires')
    has('Brake Pads, Rear Shoes & Fluid', 'brake-pads', 'brake-fluid')
    has('Differential & Transmission Fluid', 'trans-auto', 'trans-manual', 'diff-4x4')
    has('Coolant Flush & Drive Belt Inspection', 'coolant', 'drive-belt')
  })
  it('the original motorcycle starter list is recognised', () => {
    has('Chain Clean, Lube & Slack Check', 'chain')
    has('Engine Oil & Strainer/Filter', 'engine-oil')
    has('Air Filter & Spark Plug', 'air-filter', 'spark-plugs')
    has('Brake Pads/Shoes & Fluid', 'brake-pads-moto', 'brake-fluid')
    has('Drive Chain & Sprocket Set', 'chain')
    has('Front Fork Oil & Steering Head Bearing', 'fork-oil')
    has('Tires & Valve Clearance Check', 'tires', 'valve-clearance')
  })
  it('hand-typed names are recognised, including Filipino ones', () => {
    has('oil change', 'engine-oil'); has('Pagpalit ng langis', 'engine-oil'); has('Change oil', 'engine-oil')
    has('Spark plug', 'spark-plugs'); has('Battery', 'battery'); has('Gulong', 'tires'); has('Aircon cleaning', 'ac-clean')
    has('CVT fluid', 'trans-cvt'); has('Tranny oil', 'trans-auto'); has('Wiper blades', 'wipers'); has('Timing belt', 'timing-belt')
  })
  it('an item with its own guide key covers exactly that key, whatever its name says', () => {
    expect(covers('Anything at all', 'engine-oil')).toEqual(['engine-oil'])
    expect(covers('Engine Oil & Oil Filter', 'cabin-filter')).toEqual(['cabin-filter'])
  })
  it('does not over-claim: unrelated items are not swallowed', () => {
    lacks('Chain Clean, Lube & Slack Check', 'engine-oil', 'brake-fluid', 'tires')
    lacks('Tire Rotation & Alignment Check', 'engine-oil', 'brake-pads')
    lacks('Battery', 'engine-oil', 'tires')
    lacks('Wiper blades', 'engine-oil', 'battery')
    lacks('Spark plug', 'air-filter', 'engine-oil')
    expect(covers('Something unrelated and odd')).toEqual([])
    expect(covers('')).toEqual([])
  })
  it('after a vehicle tracks the old starter list, setup offers only what is genuinely missing', () => {
    const legacy = ['Engine Oil & Oil Filter', 'Fuel Filter & Water Separator Check', 'Engine Air & Cabin A/C Filter', 'Tire Rotation & Alignment Check', 'Brake Pads, Rear Shoes & Fluid', 'Differential & Transmission Fluid', 'Coolant Flush & Drive Belt Inspection']
    const have = new Set<string>(); for (const n of legacy) keysCoveredBy({ name: n }).forEach((k) => have.add(k))
    const offered = planFor({ type: 'car', fuelType: 'Diesel', transmission: 'automatic' }).filter((p) => !have.has(p.key)).map((p) => p.key)
    for (const dup of ['engine-oil', 'oil-filter', 'air-filter', 'cabin-filter', 'fuel-filter', 'tires', 'brake-fluid', 'brake-pads', 'coolant', 'drive-belt', 'trans-auto'] as GuideKey[]) expect(offered, `${dup} is already tracked`).not.toContain(dup)
    // what is genuinely new: things the old list never covered
    expect(offered).toEqual(expect.arrayContaining(['battery', 'wipers']))
  })
})
