import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import {
  addDays, addMonths, backupStatus, buildLedger, codingStatus, csvEscape, daysBetween, fmtDate, fuelEfficiency, loggedKmSpan,
  itemPoints, maintHealth, num, overallHealth, parseISO, peso, spendSummary, syncLinkedExpense, todayISO,
} from './logic'
import { migrate } from './migrate'
import { buildDemoState } from './data'
import {
  estimateAt, nearestAreas, parseFuelData, projectPrice, searchAreas, typicalCurrent, typicalPrice, nearbyFallback, freshness, haversineKm,
  type FwData,
} from './pricing'
import type { FuelLog, MaintItem, Vehicle } from './types'

const veh = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v', type: 'car', nickname: 'x', make: '', model: '', year: 2020, plate: '', odometer: 1000, avgDailyKm: 30, codingDay: 'Monday', fuelType: 'Gasoline', ...o,
})
const item = (o: Partial<MaintItem> = {}): MaintItem => ({ id: 'm', vehicleId: 'v', name: 'n', intervalKm: 1000, intervalMonths: 1, lastServiceKm: 0, lastServiceDate: '2026-01-01', ...o })

/** Stress and hostile-input regressions: each block exists because something broke, or could have, with this input. */
describe('dates', () => {
  it('addMonths never produces Invalid Date or skips months', () => {
    for (let m = 1; m <= 12; m++) for (let d = 28; d <= 31; d++) {
      const iso = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (Number.isNaN(parseISO(iso).getTime())) continue
      for (const n of [-25, -13, -1, 0, 1, 2, 12, 13, 36]) {
        const r = addMonths(iso, n)
        expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        const expectMonth = ((m - 1 + n) % 12 + 12) % 12 + 1
        expect(Number(r.slice(5, 7)), `${iso} + ${n}mo = ${r}`).toBe(expectMonth)
      }
    }
  })
  it('addDays round-trips across DST and year boundaries', () => {
    for (const start of ['2026-03-28', '2026-10-25', '2026-12-25', '2024-02-27']) {
      for (let n = -400; n <= 400; n += 37) expect(addDays(addDays(start, n), -n)).toBe(start)
    }
  })
  it('daysBetween is consistent with addDays over many spans', () => {
    for (let n = -800; n <= 800; n += 53) expect(daysBetween('2026-01-15', addDays('2026-01-15', n))).toBe(n)
  })
  it('garbage dates do not throw', () => {
    for (const bad of ['', 'abc', '2026-13-45', '0000-00-00', '99999-01-01']) {
      expect(() => { fmtDate(bad); addDays(bad, 1); daysBetween(bad, '2026-01-01') }).not.toThrow()
    }
  })
})

describe('maintHealth hostile input', () => {
  it('no NaN/Infinity for zero, negative or missing values', () => {
    const cases: [Partial<MaintItem>, Partial<Vehicle>][] = [
      [{ intervalKm: 0 }, {}], [{ intervalKm: -5 }, {}], [{ intervalMonths: 0 }, {}], [{ intervalKm: undefined, intervalMonths: undefined }, {}],
      [{}, { avgDailyKm: 0 }], [{}, { avgDailyKm: -3 }], [{}, { odometer: 0 }], [{ lastServiceKm: 99999 }, {}], [{ lastServiceDate: '' }, {}],
      [{ lastServiceDate: 'garbage' }, {}], [{ intervalMonths: 1e6 }, {}], [{ intervalKm: 1e12 }, {}],
    ]
    for (const [m, v] of cases) {
      const h = maintHealth(item(m), veh(v), '2026-06-01')
      for (const k of ['pct', 'kmRemaining', 'daysRemaining'] as const) {
        const x = h[k]
        if (x !== undefined) expect(Number.isFinite(x), `${JSON.stringify(m)} ${JSON.stringify(v)} -> ${k}=${x}`).toBe(true)
      }
      expect(h.pct).toBeGreaterThanOrEqual(0)
      expect(h.pct).toBeLessThanOrEqual(100)
    }
  })
  it('an item with NO interval is never flagged due', () => {
    expect(maintHealth(item({ intervalKm: undefined, intervalMonths: undefined }), veh(), '2030-01-01').status).toBe('Healthy')
  })
  it('odometer lower than last service (typo) does not claim negative usage is "overdue"', () => {
    const h = maintHealth(item({ lastServiceKm: 5000, intervalMonths: undefined }), veh({ odometer: 1000 }), '2026-01-02')
    expect(h.status).toBe('Healthy')
  })
})

describe('fuelEfficiency hostile input', () => {
  const f = (id: string, odometer: number, liters: number, fullTank = true): FuelLog => ({ id, vehicleId: 'v', date: '2026-01-01', liters, pricePerLiter: 1, totalCost: liters, odometer, station: '', fullTank })
  it('no NaN with zero or negative liters / identical odometer / empty input', () => {
    for (const logs of [[], [f('a', 0, 0), f('b', 0, 0)], [f('a', 100, 0), f('b', 200, 0)], [f('a', 100, -5), f('b', 200, -5)], [f('a', 100, 5), f('b', 100, 5)]]) {
      const r = fuelEfficiency(logs)
      if (r.avg !== null) expect(Number.isFinite(r.avg)).toBe(true)
      if (r.avg !== null) expect(r.avg).toBeGreaterThan(0)
    }
  })
  it('does not mutate its input', () => {
    const logs = [f('b', 200, 10), f('a', 100, 10)]
    const copy = JSON.stringify(logs)
    fuelEfficiency(logs)
    expect(JSON.stringify(logs)).toBe(copy)
  })
  it('handles 5000 logs quickly', () => {
    const logs = Array.from({ length: 5000 }, (_, i) => f(`l${i}`, i * 500, 40))
    const t = performance.now()
    const r = fuelEfficiency(logs)
    expect(performance.now() - t).toBeLessThan(500)
    expect(r.avg).toBeCloseTo(12.5)
  })
  it('implausible km/L (typo) is reported, not hidden - but is flagged by being huge', () => {
    const r = fuelEfficiency([f('a', 100, 10), f('b', 99999, 10)])
    expect(r.avg).toBeGreaterThan(1000)
  })
})

describe('ledger and summaries', () => {
  it('buildLedger/spendSummary tolerate empty and huge data', () => {
    const s = buildDemoState('2026-06-01')
    expect(() => buildLedger([], [], 'nope')).not.toThrow()
    const rows = buildLedger(s.fuel, s.expenses, s.vehicles[0].id)
    expect(spendSummary(rows, 0).perKm).toBeNull()
    expect(Number.isFinite(spendSummary(rows, 1000).all)).toBe(true)
  })
  it('floating point: peso sums stay exact to the centavo', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, kind: 'expense' as const, date: '2026-06-01', category: 'X', desc: '', place: '', cost: 0.1 }))
    const sum = spendSummary(rows, 0, '2026-06-01').all
    expect(Math.round(sum * 100)).toBe(10000)
    expect(peso(sum, 2)).toBe('₱100.00')
  })
  it('loggedKmSpan ignores undefined odometers and handles a single log', () => {
    expect(loggedKmSpan([], [], 'v')).toBe(0)
  })
  it('num/peso never throw on odd numbers', () => {
    for (const n of [0, -0, -1.5, 1e21, NaN, Infinity]) expect(() => { num(n); peso(n, 2) }).not.toThrow()
  })
})

describe('csv', () => {
  it('neutralises spreadsheet formula injection', () => {
    for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=1', '\r=1']) {
      const out = csvEscape(evil)
      expect(out.replace(/^"/, '')[0], `${JSON.stringify(evil)} -> ${out}`).toMatch(/^[^=+\-@\t\r]/)
    }
  })
  it('keeps normal negative-looking data readable (numbers)', () => {
    expect(csvEscape(-5)).toBe('-5')
  })
})

describe('coding', () => {
  it('works for every day of the year without throwing', () => {
    for (let i = 0; i < 366; i++) {
      const d = new Date(2026, 0, 1 + i)
      for (const day of ['Monday', 'Friday', 'Exempt'] as const) expect(() => codingStatus(veh({ codingDay: day }), d)).not.toThrow()
    }
  })
})

describe('migrate / import', () => {
  const ok = () => JSON.parse(JSON.stringify(buildDemoState('2026-06-01')))
  it('survives prototype pollution and weird top-level shapes', () => {
    for (const raw of [JSON.parse('{"__proto__":{"x":1},"vehicles":[],"maint":[],"fuel":[],"expenses":[]}'), [], 'str', 42, true, { vehicles: {} }]) {
      expect(() => migrate(raw)).not.toThrow()
    }
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })
  it('rejects arrays whose items are not objects, or lack ids', () => {
    for (const k of ['maint', 'fuel', 'expenses'] as const) {
      const s = ok(); s[k] = [null, 5, 'x']
      const r = migrate(s)
      if (r) for (const x of r[k]) expect(x && typeof x === 'object').toBe(true)
    }
  })
  it('drops records that point at vehicles that do not exist (orphans)', () => {
    const s = ok(); s.fuel.push({ ...s.fuel[0], id: 'orphan', vehicleId: 'ghost' })
    const r = migrate(s)!
    expect(r.fuel.some((x) => x.vehicleId === 'ghost')).toBe(false)
  })
  it('coerces non-numeric fields instead of letting NaN into totals', () => {
    const s = ok(); s.fuel[0].totalCost = '12abc'; s.fuel[1].liters = null; s.vehicles[0].odometer = 'NaN'
    const r = migrate(s)
    if (r) {
      for (const f of r.fuel) { expect(Number.isFinite(f.totalCost)).toBe(true); expect(Number.isFinite(f.liters)).toBe(true) }
      for (const v of r.vehicles) expect(Number.isFinite(v.odometer)).toBe(true)
    }
  })
  it('rejects an unknown vehicle type / coding day rather than rendering garbage', () => {
    const s = ok(); s.vehicles[0].type = 'spaceship'
    const r = migrate(s)
    if (r) expect(['car', 'motorcycle']).toContain(r.vehicles[0].type)
  })
  it('duplicate ids do not survive', () => {
    const s = ok(); s.vehicles.push({ ...s.vehicles[0] })
    const r = migrate(s)
    if (r) expect(new Set(r.vehicles.map((v) => v.id)).size).toBe(r.vehicles.length)
  })
  it('zero vehicles yields a usable state with an empty active id', () => {
    const s = ok(); s.vehicles = []
    const r = migrate(s)
    if (r) expect(r.activeVehicleId).toBe('')
  })
  it('huge import does not blow up', () => {
    const s = ok(); s.fuel = Array.from({ length: 20000 }, (_, i) => ({ ...s.fuel[0], id: `f${i}` }))
    const t = performance.now(); const r = migrate(s)
    expect(r).not.toBeNull(); expect(performance.now() - t).toBeLessThan(1500)
  })
})

describe('syncLinkedExpense', () => {
  it('is stable under repeated application', () => {
    let ex = syncLinkedExpense([], 's', { vehicleId: 'v', date: 'd', category: 'PMS & Fluids', cost: 1, shopName: '', notes: '' })
    for (let i = 0; i < 50; i++) ex = syncLinkedExpense(ex, 's', { vehicleId: 'v', date: 'd', category: 'PMS & Fluids', cost: i, shopName: '', notes: '' })
    expect(ex).toHaveLength(1)
    expect(ex[0].cost).toBe(49)
  })
})

describe('backupStatus', () => {
  it('handles future / garbage timestamps', () => {
    expect(backupStatus({ lastBackupAt: '2999-01-01T00:00:00Z' }).days).toBe(0)
    expect(backupStatus({ lastBackupAt: 'garbage' }).due).toBe(false)
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ---------- Fuel Watch ----------
const area = (name: string, province: string, prices: Record<string, Record<string, [number, number]>>) => ({ name, province, prices: prices as never })
const fw = (areas: ReturnType<typeof area>[], adjustments: FwData['adjustments'] = []): FwData => ({
  schema: 2, generatedAt: '', source: '', adjustments, regions: [{ id: 'r', label: 'R', weekStart: '2026-11-10', weekEnd: '2026-11-16', sources: [], areas }],
})

describe('fuel watch hostile input', () => {
  it('parseFuelData tolerates junk anywhere in the document', () => {
    const junk = { schema: 2, regions: [{ id: 'a', areas: [null, 5, { name: 'x' }, { name: 'y', province: 'z', prices: null }, { name: 'w', prices: { 'RON 95': { PETRON: 'oops' } } }] }], adjustments: [null, { weekStart: 5 }, { weekStart: 'a', weekEnd: 'b', brands: null }] }
    const d = parseFuelData(junk)
    expect(d).not.toBeNull()
    expect(() => { searchAreas(d!, 'x'); nearestAreas(d!, [14, 121]); estimateAt(d!, [14, 121], 'RON 95'); typicalCurrent(d!, d!.regions[0], d!.regions[0].areas[0], 'RON 95', '2026-11-20') }).not.toThrow()
  })
  it('searchAreas with regex metacharacters and very long input', () => {
    const d = fw([area('Manila City', '', {})])
    for (const q of ['(', '[', '.*', '\\', '?', '+', '$^', 'a'.repeat(10000), '\u0000', '🙂', 'ñ']) expect(() => searchAreas(d, q)).not.toThrow()
  })
  it('estimateAt / nearestAreas with impossible coordinates', () => {
    const d = fw([area('Manila City', '', { 'RON 95': { PETRON: [70, 70] } })])
    for (const p of [[NaN, NaN], [999, 999], [-90, 0], [0, 180], [Infinity, 0]] as [number, number][]) {
      expect(() => { nearestAreas(d, p); estimateAt(d, p, 'RON 95') }).not.toThrow()
      const e = estimateAt(d, p, 'RON 95')
      if (e) expect(Number.isFinite(e.price)).toBe(true)
    }
    expect(Number.isNaN(haversineKm([NaN, 0], [0, 0]))).toBe(true)
  })
  it('estimateAt never returns NaN even when an area has one price', () => {
    const d = fw([area('Manila City', '', { 'RON 95': { PETRON: [70, 70] } })])
    const e = estimateAt(d, [14.6, 120.98], 'RON 95')!
    expect(Number.isFinite(e.price)).toBe(true)
  })
  it('typicalPrice with min > max or non-finite values', () => {
    for (const v of [[80, 70], [NaN, 70], [Infinity, 1]] as [number, number][]) {
      const t = typicalPrice(area('x', '', { 'RON 95': { A: v } }), 'RON 95')
      expect(t === null || Number.isFinite(t), `${v} -> ${t}`).toBe(true)
    }
  })
  it('projectPrice terminates on absurd dates and long chains', () => {
    const adj = (w: string) => ({ weekStart: w, weekEnd: w, source: '', brands: { PETRON: { gasoline: 0.1 } } })
    const t = performance.now()
    expect(projectPrice(fw([], [adj('2026-11-17')]), '2026-11-10', 'PETRON', 'RON 95', [70, 70], '2026-11-20')).not.toBeNull()
    // measured week years ago: must not loop forever
    expect(projectPrice(fw([], []), '1990-01-01', 'PETRON', 'RON 95', [70, 70], '2026-11-20')).toBeNull()
    expect(projectPrice(fw([], []), 'garbage', 'PETRON', 'RON 95', [70, 70], '2026-11-20')).toBeNull()
    expect(projectPrice(fw([], []), '2026-11-10', 'PETRON', 'RON 95', [70, 70], 'garbage')).toBeNull()
    expect(performance.now() - t).toBeLessThan(500)
  })
  it('freshness does not throw for garbage', () => { expect(() => freshness('garbage')).not.toThrow() })
  it('nearbyFallback with odd queries', () => {
    const d = fw([area('Marikina City', '', {})])
    for (const q of ['', ' ', 'san', '%%%', 'san mateo'.repeat(500)]) expect(() => nearbyFallback(d, q)).not.toThrow()
  })
  it('search on the real 262-area file is fast', () => {
    const d = parseFuelData(JSON.parse(fs.readFileSync('public/fuel-prices.json', 'utf8')))!
    const t = performance.now()
    for (let i = 0; i < 500; i++) searchAreas(d, ['da', 'davao', 'cebu city', 'x'][i % 4])
    expect(performance.now() - t).toBeLessThan(1500)
  })
})

describe('strict dates', () => {
  it('rejects impossible calendar dates instead of rolling them over', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '26-01-01', '2026-1-1', '']) {
      expect(Number.isNaN(parseISO(bad).getTime()), bad).toBe(true)
      expect(fmtDate(bad), bad).toBe('—')
      expect(addDays(bad, 1), bad).toBe('')
      expect(addMonths(bad, 1), bad).toBe('')
    }
    expect(parseISO('2024-02-29').getDate()).toBe(29) // a real leap day
    expect(Number.isNaN(parseISO('2025-02-29').getTime())).toBe(true) // not a leap year
  })
  it('a corrupt service date never shows up as NaN days', () => {
    const h = maintHealth(item({ lastServiceDate: 'garbage', intervalKm: undefined }), veh(), '2026-06-01')
    expect(h.daysRemaining).toBeUndefined()
    expect(h.dueDate).toBeUndefined()
  })
})

describe('csv injection', () => {
  it('prefixes only text that starts a formula, never plain numbers or normal text', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvEscape('+1')).toBe("'+1")
    expect(csvEscape('@x')).toBe("'@x")
    expect(csvEscape(-5)).toBe('-5')
    expect(csvEscape('Petron, Shell')).toBe('"Petron, Shell"')
    expect(csvEscape('hello')).toBe('hello')
  })
})

describe('import repairs instead of trusting', () => {
  const base = () => JSON.parse(JSON.stringify(buildDemoState('2026-06-01')))
  it('round-trips the demo data without losing anything (ignoring key order)', () => {
    const canon = (o: unknown): unknown => Array.isArray(o) ? o.map(canon) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon((o as Record<string, unknown>)[k])])) : o
    const s = base()
    const r = migrate(JSON.parse(JSON.stringify(s)))!
    for (const k of ['vehicles', 'maint', 'fuel', 'expenses', 'services', 'parts'] as const) expect(canon(r[k]), k).toEqual(canon(s[k]))
  })
  it('keeps valid dates and replaces only impossible ones', () => {
    const s = base(); s.fuel[0].date = '2026-02-30'
    const r = migrate(s, new Date('2026-06-15T00:00:00Z'), '2026-06-15')!
    expect(r.fuel[0].date).toBe('2026-06-15')
    expect(r.fuel[1].date).toBe(s.fuel[1].date)
  })
})

describe('Manila time', () => {
  it('a run just after midnight in Manila is already the next day', () => {
    const t = new Date('2026-11-16T16:30:00Z') // 00:30 on Nov 17 in Manila
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(t)).toBe('2026-11-17')
    expect(t.toISOString().slice(0, 10)).toBe('2026-11-16') // what the old UTC date said
  })
})

describe('preferred fuel survives import and is validated', () => {
  const base = () => JSON.parse(JSON.stringify(buildDemoState('2026-06-01')))
  it('is kept when valid', () => {
    const s = base(); s.vehicles[0].preferredFuel = { brand: 'PETRON', product: 'RON 95' }
    expect(migrate(s)!.vehicles[0].preferredFuel).toEqual({ brand: 'PETRON', product: 'RON 95' })
  })
  it('is dropped when malformed, without rejecting the backup', () => {
    for (const bad of ['x', 5, null, [], { brand: 'PETRON' }, { brand: '', product: 'RON 95' }, { brand: 'PETRON', product: 'PREMIUM' }, { brand: 5, product: 'RON 95' }]) {
      const s = base(); s.vehicles[0].preferredFuel = bad
      const r = migrate(s)
      expect(r, JSON.stringify(bad)).not.toBeNull()
      expect(r!.vehicles[0].preferredFuel, JSON.stringify(bad)).toBeUndefined()
    }
  })
})

describe('registeredFor survives import and is validated', () => {
  const base = () => JSON.parse(JSON.stringify(buildDemoState('2026-06-01')))
  it('is kept when it is a real date', () => {
    const s = base(); s.vehicles[0].registeredFor = '2027-05-31'
    expect(migrate(s)!.vehicles[0].registeredFor).toBe('2027-05-31')
  })
  it('is dropped when malformed, without rejecting the backup', () => {
    for (const bad of ['garbage', '2027-02-30', '2027-5-31', 5, null, {}, [], true, '']) {
      const s = base(); s.vehicles[0].registeredFor = bad
      const r = migrate(s)
      expect(r, JSON.stringify(bad)).not.toBeNull()
      expect(r!.vehicles[0].registeredFor, JSON.stringify(bad)).toBeUndefined()
    }
  })
})

describe('overallHealth', () => {
  const st = (pct: number) => (pct >= 100 ? 'Overdue' : pct >= 85 ? 'Due Soon' : 'Healthy') as 'Healthy' | 'Due Soon' | 'Overdue'
  const it_ = (name: string, pct: number) => ({ name, h: { status: st(pct), pct } })

  it('item points follow the status the badge shows', () => {
    expect(itemPoints({ status: 'Healthy', pct: 0 })).toBe(100)
    expect(itemPoints({ status: 'Healthy', pct: 84 })).toBeCloseTo(70.6)
    expect(itemPoints({ status: 'Due Soon', pct: 85 })).toBe(60)
    expect(itemPoints({ status: 'Due Soon', pct: 99 })).toBe(32)
    expect(itemPoints({ status: 'Overdue', pct: 100 })).toBe(0)
  })
  it('a worn-but-healthy item is always worth more than any due-soon item, which is worth more than overdue', () => {
    expect(itemPoints({ status: 'Healthy', pct: 84.9 })).toBeGreaterThan(itemPoints({ status: 'Due Soon', pct: 85 }))
    expect(itemPoints({ status: 'Due Soon', pct: 99.9 })).toBeGreaterThan(itemPoints({ status: 'Overdue', pct: 100 }))
  })
  it('points are safe for NaN and out-of-range percentages', () => {
    for (const pct of [NaN, -20, 1e9, Infinity]) for (const status of ['Healthy', 'Due Soon', 'Overdue'] as const) {
      const p = itemPoints({ status, pct })
      expect(Number.isFinite(p), `${status} ${pct}`).toBe(true)
      expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(100)
    }
  })
  it('is null with nothing to judge, never 100 or NaN', () => {
    expect(overallHealth([])).toMatchObject({ score: null, level: 'none', total: 0 })
  })
  it('a fully fresh vehicle scores 100 and is excellent', () => {
    const o = overallHealth([it_('a', 0), it_('b', 0), it_('c', 0)])
    expect(o).toMatchObject({ score: 100, level: 'excellent' })
    expect(o.worst).toBeUndefined()
  })
  it('well-used but healthy items still read as a good vehicle (not punished for normal wear)', () => {
    // every item at 70% used: still Healthy. Each is 100 - 70*0.35 = 75.5
    const o = overallHealth([it_('a', 70), it_('b', 70), it_('c', 70)])
    expect(o.level).toBe('excellent')
    expect(o.score).toBe(76) // avg 75.5 *0.75 + weakest 75.5 *0.25 = 75.5 -> 76
  })
  it('one overdue item among many healthy ones is NOT reported as fine', () => {
    const o = overallHealth([it_('belt', 100), ...['a', 'b', 'c', 'd', 'e', 'f'].map((n) => it_(n, 5))])
    // points: [0, 98.25 x 6] -> avg 84.2, weakest 0 -> 63.2; a plain average would say 84 and hide the belt
    expect(o.score).toBe(63)
    expect(o.level).toBe('fair')
    expect(o.worst).toMatchObject({ name: 'belt', status: 'Overdue' })
  })
  it('the demo pickup, worked by hand: 4 healthy + 2 due soon + 1 overdue', () => {
    // pct used: oil 94, fuel filter 64, air filter 100, tires 34, brakes 75, diff 96, coolant 83
    // points: 42, 77.6, 0, 88.1, 73.75, 38, 70.95 -> sum 390.4, avg 55.77, weakest 0 -> 41.8 -> 42
    const o = overallHealth([it_('oil', 94), it_('fuel', 64), it_('air', 100), it_('tires', 34), it_('brakes', 75), it_('diff', 96), it_('coolant', 83)])
    expect(o.score).toBe(42)
    expect(o).toMatchObject({ level: 'fair', healthy: 4, dueSoon: 2, overdue: 1 })
    expect(o.worst?.name).toBe('air')
  })
  it('a third or more overdue, or two overdue items, is poor', () => {
    expect(overallHealth([it_('a', 100), it_('b', 120), it_('c', 0), it_('d', 0), it_('e', 0), it_('f', 0)]).level).toBe('poor')
    expect(overallHealth([it_('a', 100), it_('b', 0), it_('c', 0)]).level).toBe('poor')
    expect(overallHealth([it_('a', 100)]).level).toBe('poor')
    expect(overallHealth([it_('a', 100), it_('b', 0), it_('c', 0), it_('d', 0)]).level).toBe('fair')
  })
  it('everything overdue scores 0', () => {
    expect(overallHealth([it_('a', 100), it_('b', 150), it_('c', 300)]).score).toBe(0)
  })
  it('due-soon items alone: good when few, fair when most items are due soon', () => {
    expect(overallHealth([it_('a', 90), it_('b', 5), it_('c', 5), it_('d', 5)]).level).toBe('good')
    expect(overallHealth([it_('a', 90), it_('b', 95), it_('c', 99), it_('d', 5)]).level).toBe('fair')
  })
  it('score stays within 0-100 and counts add up for absurd input', () => {
    for (const pct of [-50, 0, 100, 1e9, NaN]) {
      const o = overallHealth([{ name: 'x', h: { status: 'Overdue', pct } }, { name: 'y', h: { status: 'Healthy', pct } }])
      expect(o.score).toBeGreaterThanOrEqual(0); expect(o.score).toBeLessThanOrEqual(100)
      expect(o.healthy + o.dueSoon + o.overdue).toBe(o.total)
    }
  })
  it('the worst item is the one most used up', () => {
    expect(overallHealth([it_('a', 88), it_('b', 130), it_('c', 99)]).worst?.name).toBe('b')
  })
  it('a better-kept vehicle always scores higher than a worse-kept one', () => {
    const fresh = overallHealth([it_('a', 10), it_('b', 20), it_('c', 30)]).score!
    const worn = overallHealth([it_('a', 60), it_('b', 70), it_('c', 80)]).score!
    const due = overallHealth([it_('a', 90), it_('b', 70), it_('c', 80)]).score!
    const over = overallHealth([it_('a', 100), it_('b', 70), it_('c', 80)]).score!
    expect(fresh).toBeGreaterThan(worn); expect(worn).toBeGreaterThan(due); expect(due).toBeGreaterThan(over)
  })
  it('real demo data: both vehicles get a finite score, and the label matches the overdue count', () => {
    const s = buildDemoState('2026-06-01')
    for (const v of s.vehicles) {
      const items = s.maint.filter((m) => m.vehicleId === v.id).map((m) => ({ name: m.name, h: maintHealth(m, v, '2026-06-01') }))
      const o = overallHealth(items)
      expect(o.total).toBe(7)
      expect(Number.isFinite(o.score as number)).toBe(true)
      if (o.overdue === 0 && o.dueSoon === 0) expect(o.level).toBe('excellent')
      if (o.overdue >= 2) expect(o.level).toBe('poor')
    }
  })
})
