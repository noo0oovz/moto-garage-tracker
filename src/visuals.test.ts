import { describe, expect, it } from 'vitest'
import { GUIDE, type GuideKey } from './intervals'
import { PART_ICON, PART_LABEL } from './PartIcon'
import { artKind, ART_KINDS } from './VehicleArt'
import { headlineLimit, limits, spanLabel, maintHealth } from './logic'
import type { MaintItem, Vehicle } from './types'

const veh = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v', type: 'car', nickname: 'x', make: '', model: '', year: 2020, plate: '', odometer: 10000, avgDailyKm: 30, codingDay: 'Exempt', fuelType: 'Gasoline', ...o,
})

describe('part icons', () => {
  const keys = Object.keys(GUIDE) as GuideKey[]
  it('every maintenance item the app can suggest has an icon and a label', () => {
    for (const k of keys) {
      expect(PART_ICON[k], `icon for ${k}`).toBeTruthy()
      expect(PART_LABEL[k], `label for ${k}`).toBeTruthy()
    }
  })
  it('no icon is listed for an item that does not exist', () => {
    for (const k of Object.keys(PART_ICON)) expect(keys, k).toContain(k)
  })
  it('the oil, filter and belt items do not all share one icon', () => {
    expect(PART_ICON['engine-oil']).not.toBe(PART_ICON['air-filter'])
    expect(PART_ICON['spark-plugs']).not.toBe(PART_ICON['battery'])
    expect(PART_ICON['tires']).not.toBe(PART_ICON['brake-pads'])
  })
})

describe('vehicle illustrations', () => {
  it('there is one for each of the five vehicle kinds', () => {
    expect([...ART_KINDS].sort()).toEqual(['bigbike', 'car', 'motorcycle', 'pickup', 'scooter'])
  })
  it('a motorcycle gets the illustration for its bike type', () => {
    const m = (bikeType: 'scooter' | 'small' | 'mid' | 'big' | undefined) => artKind(veh({ type: 'motorcycle', bikeType }))
    expect(m('scooter')).toBe('scooter')
    expect(m('small')).toBe('motorcycle')
    expect(m('mid')).toBe('bigbike')
    expect(m('big')).toBe('bigbike')
    expect(m(undefined)).toBe('motorcycle')
  })
  it('a car is a pickup only when its name says so', () => {
    expect(artKind(veh({ make: 'Toyota', model: 'Hilux G 4x2' }))).toBe('pickup')
    expect(artKind(veh({ make: 'Ford', model: 'Ranger' }))).toBe('pickup')
    expect(artKind(veh({ make: 'Mitsubishi', model: 'L200' }))).toBe('pickup')
    expect(artKind(veh({ make: 'Toyota', model: 'Vios' }))).toBe('car')
    expect(artKind(veh({ make: 'Honda', model: 'City' }))).toBe('car')
    expect(artKind(veh({}))).toBe('car')
  })
  it('never throws for odd names', () => {
    for (const n of ['', '   ', '💥', 'A'.repeat(5000), '<b>', '(((']) expect(() => artKind(veh({ nickname: n, model: n, make: n }))).not.toThrow()
  })
})

describe('interval limits in words', () => {
  it('distance left, and distance over', () => {
    expect(limits({ kmRemaining: 1700 }).km).toEqual({ label: '1,700 km left', over: false, known: true })
    expect(limits({ kmRemaining: -400 }).km).toEqual({ label: '400 km over', over: true, known: true })
    expect(limits({ kmRemaining: 0 }).km.over).toBe(false)
  })
  it('time left, and time over, in sensible units', () => {
    expect(limits({ daysRemaining: 5 }).time.label).toBe('5 days left')
    expect(limits({ daysRemaining: 1 }).time.label).toBe('1 day left')
    expect(limits({ daysRemaining: 20 }).time.label).toBe('about 3 weeks left')
    expect(limits({ daysRemaining: 90 }).time.label).toBe('about 3 months left')
    expect(limits({ daysRemaining: -12 }).time).toEqual({ label: '12 days over', over: true, known: true })
  })
  it('a missing or broken limit is unknown, never "NaN" or a dash', () => {
    for (const bad of [undefined, NaN, Infinity, -Infinity]) {
      const r = limits({ kmRemaining: bad as number, daysRemaining: bad as number })
      expect(r.km.known).toBe(false)
      expect(r.time.known).toBe(false)
      expect(r.km.label + r.time.label).not.toMatch(/NaN|undefined|Infinity/)
    }
  })
  it('spanLabel never prints a negative or non-numeric value', () => {
    for (const d of [0, 0.4, 13, 14, 59, 60, 400, -3, -90, 1e9]) expect(spanLabel(d)).toMatch(/^(about )?\d+ (day|week|month)s?$/)
  })
})

describe('which limit is the headline', () => {
  const item = (o: Partial<MaintItem> = {}): MaintItem => ({ id: 'm', vehicleId: 'v', name: 'Oil', intervalKm: 5000, intervalMonths: 6, lastServiceKm: 0, lastServiceDate: '2026-01-01', ...o })
  const today = '2026-06-15'
  it('is the limit that runs out first, comparing like with like', () => {
    // 100 km left at 30 km/day is about 3 days; the date limit is months away: distance wins
    const a = item({ lastServiceKm: 9900, lastServiceDate: '2026-06-01' })
    expect(headlineLimit(a, maintHealth(a, veh({ odometer: 14800, avgDailyKm: 30 }), today), 30, today)).toBe('km')
    // 4,000 km left at 30 km/day is 133 days, but the date limit is days away: time wins
    const b = item({ lastServiceKm: 10000, lastServiceDate: '2026-01-10' })
    expect(headlineLimit(b, maintHealth(b, veh({ odometer: 11000, avgDailyKm: 30 }), today), 30, today)).toBe('time')
  })
  it('an item with only one kind of interval always headlines it', () => {
    const km = item({ intervalMonths: undefined })
    expect(headlineLimit(km, maintHealth(km, veh(), today), 30, today)).toBe('km')
    const mo = item({ intervalKm: undefined })
    expect(headlineLimit(mo, maintHealth(mo, veh(), today), 30, today)).toBe('time')
  })
  it('with no daily distance, it prefers distance and does not divide by zero', () => {
    const a = item()
    expect(() => headlineLimit(a, maintHealth(a, veh({ avgDailyKm: 0 }), today), 0, today)).not.toThrow()
    expect(headlineLimit(a, maintHealth(a, veh({ avgDailyKm: 0 }), today), 0, today)).toBe('km')
  })
  it('an item with no limits at all headlines nothing', () => {
    const a = item({ intervalKm: undefined, intervalMonths: undefined })
    expect(headlineLimit(a, maintHealth(a, veh(), today), 30, today)).toBe('none')
  })
})

describe('icon for an item without a guide key', () => {
  it('uses its guide key when it has one', async () => {
    const { partKeyFor } = await import('./PartIcon')
    expect(partKeyFor({ guideKey: 'battery', name: 'anything' })).toBe('battery')
  })
  it('falls back to the name, specific before general', async () => {
    const { partKeyFor } = await import('./PartIcon')
    const k = (name: string) => partKeyFor({ name })
    expect(k('Engine Oil & Oil Filter')).toBe('engine-oil')
    expect(k('Engine Oil & Strainer/Filter')).toBe('engine-oil')
    expect(k('Oil filter')).toBe('oil-filter')
    expect(k('Engine Air & Cabin A/C Filter')).toBe('air-filter') // the first-named part wins
    expect(k('Air Filter & Spark Plug')).toBe('air-filter')
    expect(k('Fuel Filter & Water Separator Check')).toBe('fuel-filter')
    expect(k('Brake Pads, Rear Shoes & Fluid')).toBe('brake-fluid')
    expect(k('Brake Pads/Shoes & Fluid')).toBe('brake-fluid')
    expect(k('Tire Rotation & Alignment Check')).toBe('tires')
    expect(k('Tires & Valve Clearance Check')).toBe('tires')
    expect(k('Coolant Flush & Drive Belt Inspection')).toBe('coolant')
    expect(k('Differential & Transmission Fluid')).toBe('trans-auto')
    expect(k('Chain Clean, Lube & Slack Check')).toBe('chain')
    expect(k('Drive Chain & Sprocket Set')).toBe('chain')
    expect(k('Front Fork Oil & Steering Head Bearing')).toBe('fork-oil')
    expect(k('Wiper blades')).toBe('wipers')
  })
  it('every sample-garage item gets a specific icon, not the generic spanner', async () => {
    const { partKeyFor } = await import('./PartIcon')
    const { CAR_TEMPLATE, MOTO_TEMPLATE } = await import('./data')
    for (const t of [...CAR_TEMPLATE, ...MOTO_TEMPLATE]) expect(partKeyFor({ name: t.name }), t.name).toBeTruthy()
  })
  it('an unrecognised or odd name gives nothing (the spanner), and never throws', async () => {
    const { partKeyFor } = await import('./PartIcon')
    expect(partKeyFor({ name: 'Polish the chrome' })).toBeUndefined()
    for (const n of ['', '   ', '💥', 'A'.repeat(5000), '(((', undefined as unknown as string]) expect(() => partKeyFor({ name: n })).not.toThrow()
    expect(partKeyFor({ guideKey: '__proto__', name: 'x' })).toBeUndefined()
    expect(partKeyFor({ guideKey: 'constructor', name: 'x' })).toBeUndefined()
  })
})

describe('hero subtitle', () => {
  const sub = async (o: Partial<Vehicle>) => { const { subtitle } = await import('./VehicleHero'); return subtitle({ nickname: 'x', plate: '', make: '', model: '', year: 2020, type: 'car', ...o }) }
  it('does not repeat what the nickname already says', async () => {
    expect(await sub({ nickname: '2018 Toyota Hilux G 4x2', plate: 'NBC 1235', make: 'Toyota', model: 'Hilux G 4x2', year: 2018 })).toBe('NBC 1235')
  })
  it('adds make and model when the nickname is just a name', async () => {
    expect(await sub({ nickname: 'Maxi', plate: '123 ABC', make: 'Honda', model: 'Click 160', year: 2022, type: 'motorcycle' })).toBe('123 ABC · 2022 Honda Click 160')
  })
  it('falls back to the vehicle type when there is nothing else to say', async () => {
    expect(await sub({ nickname: 'Bike', type: 'motorcycle', make: '', model: '', year: 2020 })).toContain('2020')
    expect(await sub({ nickname: 'Car', plate: '', make: '', model: '', year: NaN as unknown as number })).not.toMatch(/NaN/)
  })
})

describe('the small icon and the big illustration agree', () => {
  it('for every motorcycle the two pick the same kind of vehicle', async () => {
    const { VehicleIcon } = await import('./VehicleIcon')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { createElement } = await import('react')
    const bikes: Partial<Vehicle>[] = []
    for (const bikeType of [undefined, 'scooter', 'small', 'mid', 'big'] as const)
      for (const transmission of [undefined, 'cvt', 'automatic', 'manual'] as const)
        for (const engineCc of [undefined, 110, 155, 250, 650] as const) bikes.push({ type: 'motorcycle', bikeType, transmission, engineCc })
    for (const b of bikes) {
      const v = veh(b)
      const art = artKind(v)
      const html = renderToStaticMarkup(createElement(VehicleIcon, { v }))
      const iconIsScooter = /lucide-scooter/.test(html)
      expect(iconIsScooter, JSON.stringify(b)).toBe(art === 'scooter')
    }
  })
})
