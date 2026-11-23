import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { CHECKLIST_CAR, CHECKLIST_MOTO, MOTO_TEMPLATE, CAR_TEMPLATE, fuelTypesFor, partTypesFor } from './data'
import { planFor } from './intervals'
import type { Vehicle } from './types'

/** Things that only exist on a car. A motorcycle must never be asked about any of them. */
const CAR_ONLY = /wiper|cabin|radiator hose|a\/c|aircon|suspension arm|differential|4x4|diesel|timing belt|fuel filter|power steering|windshield|seatbelt/i
/** Things that only exist on a motorcycle. A car must never be asked about any of them. */
const MOTO_ONLY = /chain|sprocket|cvt|fork|rider|helmet|handlebar/i

describe('parts are offered per vehicle type', () => {
  it('a motorcycle is never offered a car-only part', () => {
    expect(partTypesFor('motorcycle').filter((p) => CAR_ONLY.test(p))).toEqual([])
  })
  it('a car is never offered a motorcycle-only part', () => {
    expect(partTypesFor('car').filter((p) => MOTO_ONLY.test(p))).toEqual([])
  })
  it('wipers are for cars only; chain and sprockets are for motorcycles only', () => {
    expect(partTypesFor('car')).toContain('Wipers')
    expect(partTypesFor('motorcycle')).not.toContain('Wipers')
    expect(partTypesFor('motorcycle')).toContain('Drive Chain & Sprockets')
    expect(partTypesFor('car')).not.toContain('Drive Chain & Sprockets')
  })
  it('both always end with "Other" and have no duplicates', () => {
    for (const t of ['car', 'motorcycle'] as const) {
      const l = partTypesFor(t)
      expect(l[l.length - 1]).toBe('Other')
      expect(new Set(l).size).toBe(l.length)
    }
  })
})

describe('maintenance plans are per vehicle type', () => {
  const motos: Pick<Vehicle, 'type' | 'fuelType' | 'engineCc' | 'transmission'>[] = []
  for (const cc of [undefined, 110, 125, 155, 160, 250, 400, 650, 1000])
    for (const transmission of ['cvt', 'manual', 'automatic'] as const) motos.push({ type: 'motorcycle', fuelType: 'Gasoline', engineCc: cc, transmission })
  const cars: Pick<Vehicle, 'type' | 'fuelType' | 'engineCc' | 'transmission'>[] = []
  for (const fuelType of ['Gasoline', 'Diesel', 'Hybrid', 'EV'] as const)
    for (const transmission of ['manual', 'automatic', 'cvt', 'dct'] as const) cars.push({ type: 'car', fuelType, transmission })

  it('no motorcycle plan contains a car-only item', () => {
    for (const m of motos) {
      const bad = planFor(m).filter((i) => CAR_ONLY.test(i.name) || CAR_ONLY.test(i.key))
      expect(bad.map((b) => b.name), JSON.stringify(m)).toEqual([])
    }
  })
  it('no car plan contains a motorcycle-only item', () => {
    for (const c of cars) {
      const bad = planFor(c).filter((i) => MOTO_ONLY.test(i.name) && !/^trans-/.test(i.key))
      expect(bad.map((b) => b.name), JSON.stringify(c)).toEqual([])
    }
  })
  it('the sample motorcycle schedule has nothing car-only, and the sample car schedule nothing motorcycle-only', () => {
    expect(MOTO_TEMPLATE.filter((t) => CAR_ONLY.test(t.name))).toEqual([])
    expect(CAR_TEMPLATE.filter((t) => MOTO_ONLY.test(t.name))).toEqual([])
  })
})

describe('checklists are per vehicle type', () => {
  it('the motorcycle checklist has no car-only wording and the car one no rider wording', () => {
    expect(CHECKLIST_MOTO.filter((c) => CAR_ONLY.test(c.label + ' ' + c.hint))).toEqual([])
    expect(CHECKLIST_CAR.filter((c) => MOTO_ONLY.test(c.label + ' ' + c.hint))).toEqual([])
  })
})

describe('fuel types', () => {
  it('motorcycles offer only gasoline and electric; cars offer all four', () => {
    expect(fuelTypesFor('motorcycle')).toEqual(['Gasoline', 'EV'])
    expect(fuelTypesFor('car')).toEqual(['Diesel', 'Gasoline', 'Hybrid', 'EV'])
  })
})

describe('vehicle icons', () => {
  const src = fs.readFileSync('src/VehicleIcon.tsx', 'utf8')
  it('uses a car, a scooter and a motorbike, never a pedal bicycle', () => {
    expect(src).toMatch(/CarFront/)
    expect(src).toMatch(/Scooter/)
    expect(src).toMatch(/Motorbike/)
    expect(src).not.toMatch(/\bBike\b/)
  })
  it('no screen draws a vehicle with the pedal-bicycle or plain car icon directly', () => {
    for (const f of ['App', 'GarageScreen', 'VehicleSwitcher', 'pages', 'pages2', 'Welcome', 'modals', 'SettingsPages']) {
      const t = fs.readFileSync(`src/${f}.tsx`, 'utf8')
      expect(t, `${f} imports lucide Bike`).not.toMatch(/import\s*\{[^}]*\bBike\b[^}]*\}\s*from\s*['"]lucide-react['"]/)
    }
  })
})

describe('bike type decides a motorcycle schedule', () => {
  const moto = (bikeType: 'scooter' | 'small' | 'mid' | 'big' | undefined, o: Partial<Vehicle> = {}) =>
    ({ type: 'motorcycle' as const, fuelType: 'Gasoline' as const, bikeType, ...o })

  it('each bike type maps to its own class, whatever the engine size or gearbox says', async () => {
    const { classOf } = await import('./intervals')
    expect(classOf(moto('scooter'))).toBe('moto-scooter-125')
    expect(classOf(moto('small'))).toBe('moto-125')
    expect(classOf(moto('small', { engineCc: 150 }))).toBe('moto-150')
    expect(classOf(moto('mid'))).toBe('moto-250-400')
    expect(classOf(moto('big'))).toBe('moto-big')
    // the owner's answer wins over a contradictory gearbox or cc
    expect(classOf(moto('big', { transmission: 'cvt', engineCc: 125 }))).toBe('moto-big')
    expect(classOf(moto('scooter', { transmission: 'manual' }))).toBe('moto-scooter-125')
  })

  it('a motorcycle saved before this question existed still gets a class from its engine size', async () => {
    const { classOf } = await import('./intervals')
    expect(classOf(moto(undefined, { engineCc: 650 }))).toBe('moto-big')
    expect(classOf(moto(undefined))).toBe('moto-125')
  })

  it('schedules differ by type: scooters get CVT items, geared bikes a chain, only mid and big get an oil filter and valve check', () => {
    const keys = (t: 'scooter' | 'small' | 'mid' | 'big') => planFor(moto(t)).map((i) => i.key)
    expect(keys('scooter')).toEqual(expect.arrayContaining(['cvt-belt', 'cvt-rollers', 'gear-oil']))
    expect(keys('scooter')).not.toContain('chain')
    for (const t of ['small', 'mid', 'big'] as const) { expect(keys(t)).toContain('chain'); expect(keys(t)).not.toContain('cvt-belt') }
    expect(keys('small')).not.toContain('oil-filter')
    expect(keys('mid')).toContain('oil-filter')
    expect(keys('big')).toEqual(expect.arrayContaining(['oil-filter', 'valve-clearance', 'coolant']))
  })

  it('bigger bikes get longer oil intervals than small ones', () => {
    const oil = (t: 'small' | 'mid' | 'big') => planFor(moto(t)).find((i) => i.key === 'engine-oil')!.intervalKm!
    expect(oil('small')).toBeLessThan(oil('mid'))
    expect(oil('mid')).toBeLessThan(oil('big'))
  })

  it('a motorcycle never gets a car-only note in its schedule, including the severe-use reason', () => {
    for (const t of ['scooter', 'small', 'mid', 'big'] as const) {
      const plan = planFor(moto(t, { driving: { heavyTraffic: true, shortTrips: true, dusty: true, towing: true } }))
      const text = plan.map((p) => `${p.name} ${p.why} ${p.adjusted ?? ''}`).join(' ')
      expect(text, t).not.toMatch(/towing|your car|inside the car|\bcar\b/i)
    }
  })
})

describe('driving questions are worded for the vehicle', () => {
  it('a motorcycle is asked about a passenger or cargo, a car about towing and heavy loads', async () => {
    const { conditionsFor } = await import('./SetupMaintenance')
    expect(conditionsFor('motorcycle').find((c) => c.key === 'towing')!.label).toMatch(/passenger|cargo/i)
    expect(conditionsFor('motorcycle').map((c) => c.label + c.hint).join(' ')).not.toMatch(/towing/i)
    expect(conditionsFor('car').find((c) => c.key === 'towing')!.label).toMatch(/heavy loads/i)
  })
})

describe('car screens mention no motorcycles', () => {
  it('the car gearbox options never refer to scooters', () => {
    const src = fs.readFileSync('src/SetupMaintenance.tsx', 'utf8')
    const block = src.slice(src.indexOf('const TRANSMISSIONS'), src.indexOf('/** What kind of motorcycle'))
    expect(block).not.toMatch(/scooter/i)
  })
})
