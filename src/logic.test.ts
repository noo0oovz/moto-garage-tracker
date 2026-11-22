import { describe, expect, it } from 'vitest'
import {
  addDays, addMonths, backupStatus, codingStatus, csvEscape, daysBetween, fuelEfficiency, latestService, maintHealth,
  syncLinkedExpense, warrantyInfo,
} from './logic'
import { migrate } from './migrate'
import type { Expense, FuelLog, MaintItem, ServiceRecord, Vehicle } from './types'

const veh = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', type: 'car', nickname: 'T', make: '', model: '', year: 2020, plate: '', odometer: 10000,
  avgDailyKm: 50, codingDay: 'Wednesday', fuelType: 'Gasoline', ...o,
})
const item = (o: Partial<MaintItem> = {}): MaintItem => ({
  id: 'm1', vehicleId: 'v1', name: 'Oil', intervalKm: 10000, intervalMonths: 6, lastServiceKm: 5000, lastServiceDate: '2026-01-01', ...o,
})
const fill = (id: string, odometer: number, liters: number, fullTank = true): FuelLog => ({
  id, vehicleId: 'v1', date: '2026-01-01', liters, pricePerLiter: 60, totalCost: liters * 60, odometer, station: '', fullTank,
})

describe('date helpers', () => {
  it('addMonths clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29') // leap year
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
  })
  it('addDays and daysBetween agree across month/year boundaries', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59)
    expect(daysBetween('2026-03-01', '2026-01-01')).toBe(-59)
  })
})

describe('maintHealth', () => {
  it('is Healthy when little of the interval is used', () => {
    // 2000 of 10000 km used (20%); 2 of 6 months elapsed (~33%)
    const h = maintHealth(item({ lastServiceKm: 8000 }), veh(), '2026-03-01')
    expect(h.status).toBe('Healthy')
    expect(h.kmRemaining).toBe(8000)
    expect(h.daysRemaining).toBe(Math.min(160, daysBetween('2026-03-01', '2026-07-01')))
  })
  it('is Due Soon from 85% used', () => {
    const h = maintHealth(item({ lastServiceKm: 1400, intervalMonths: undefined }), veh(), '2026-01-02') // 8600/10000
    expect(h.status).toBe('Due Soon')
    expect(h.kmRemaining).toBe(1400)
  })
  it('is Overdue past 100% and reports the overshoot as negative remaining', () => {
    const h = maintHealth(item({ lastServiceKm: 0, intervalMonths: undefined }), veh({ odometer: 11000 }), '2026-01-02')
    expect(h.status).toBe('Overdue')
    expect(h.kmRemaining).toBe(-1000)
    expect(h.daysRemaining).toBe(-20)
    expect(h.pct).toBe(100) // bar is capped
  })
  it('uses whichever limit (km or time) is more used', () => {
    // km barely used, but 12 months elapsed on a 6 month interval
    const h = maintHealth(item({ lastServiceKm: 9900, lastServiceDate: '2025-01-01' }), veh(), '2026-01-01')
    expect(h.status).toBe('Overdue')
  })
  it('handles time-only and km-only items', () => {
    expect(maintHealth(item({ intervalKm: undefined }), veh(), '2026-01-02').kmRemaining).toBeUndefined()
    expect(maintHealth(item({ intervalMonths: undefined }), veh(), '2026-01-02').dueDate).toBeUndefined()
  })
  it('gives no day estimate from km when avgDailyKm is 0', () => {
    const h = maintHealth(item({ intervalMonths: undefined }), veh({ avgDailyKm: 0 }), '2026-01-02')
    expect(h.daysRemaining).toBeUndefined()
  })
})

describe('fuelEfficiency', () => {
  it('computes km/L between consecutive full tanks', () => {
    // 500 km driven, 40 L to refill => 12.5 km/L
    const r = fuelEfficiency([fill('a', 1000, 30), fill('b', 1500, 40)])
    expect(r.map.b).toBeCloseTo(12.5)
    expect(r.avg).toBeCloseTo(12.5)
    expect(r.last).toBeCloseTo(12.5)
  })
  it('counts partial fills between two full tanks toward the liters used', () => {
    // 1000 -> 1600 km (600 km) using 20 (partial) + 30 (full) = 50 L => 12 km/L
    const r = fuelEfficiency([fill('a', 1000, 30), fill('p', 1300, 20, false), fill('b', 1600, 30)])
    expect(r.map.b).toBeCloseTo(12)
    expect(r.map.p).toBeUndefined()
  })
  it('ignores input order and needs two full tanks', () => {
    expect(fuelEfficiency([fill('b', 1500, 40), fill('a', 1000, 30)]).map.b).toBeCloseTo(12.5)
    expect(fuelEfficiency([fill('a', 1000, 30)]).avg).toBeNull()
    expect(fuelEfficiency([fill('a', 1000, 30, false), fill('b', 1500, 40, false)]).avg).toBeNull()
  })
  it('skips segments with no distance', () => {
    expect(fuelEfficiency([fill('a', 1000, 30), fill('b', 1000, 40)]).avg).toBeNull()
  })
})

describe('codingStatus', () => {
  const wed = new Date(2026, 10, 25) // Wednesday
  const sun = new Date(2026, 10, 22)
  it('flags coding on the vehicle’s coding day', () => {
    expect(codingStatus(veh({ codingDay: 'Wednesday' }), wed).state).toBe('coding')
    expect(codingStatus(veh({ codingDay: 'Monday' }), wed).state).toBe('free')
  })
  it('never applies on weekends', () => {
    expect(codingStatus(veh({ codingDay: 'Wednesday' }), sun).state).toBe('free')
  })
  it('exempts motorcycles, hybrids, EVs and Exempt vehicles', () => {
    expect(codingStatus(veh({ type: 'motorcycle' }), wed).state).toBe('exempt')
    expect(codingStatus(veh({ fuelType: 'Hybrid' }), wed).state).toBe('exempt')
    expect(codingStatus(veh({ fuelType: 'EV' }), wed).state).toBe('exempt')
    expect(codingStatus(veh({ codingDay: 'Exempt' }), wed).state).toBe('exempt')
  })
})

describe('warrantyInfo', () => {
  it('reports days left and expiry', () => {
    const w = warrantyInfo({ date: '2026-01-01', warrantyMonths: 6 }, '2026-06-01')
    expect(w?.active).toBe(true)
    expect(w?.days).toBe(30)
    expect(warrantyInfo({ date: '2026-01-01', warrantyMonths: 6 }, '2026-08-01')?.active).toBe(false)
    expect(warrantyInfo({ date: '2026-01-01' })).toBeNull()
  })
})

describe('service records & linked expenses', () => {
  const svc = (id: string, date: string, odometer: number): ServiceRecord => ({ id, vehicleId: 'v1', maintItemId: 'm1', name: 'Oil', date, odometer })
  it('latestService picks the newest by date, then odometer', () => {
    const l = latestService([svc('a', '2026-01-01', 100), svc('b', '2026-03-01', 200), svc('c', '2026-03-01', 300)], 'm1')
    expect(l?.id).toBe('c')
    expect(latestService([], 'm1')).toBeUndefined()
    expect(latestService([svc('a', '2026-01-01', 1)], undefined)).toBeUndefined()
  })
  const base: Omit<Expense, 'id' | 'sourceId'> = { vehicleId: 'v1', date: '2026-01-01', category: 'PMS & Fluids', cost: 100, shopName: '', notes: '' }
  it('syncLinkedExpense inserts, updates in place, and removes', () => {
    const inserted = syncLinkedExpense([], 's1', base)
    expect(inserted).toHaveLength(1)
    expect(inserted[0].sourceId).toBe('s1')
    const updated = syncLinkedExpense(inserted, 's1', { ...base, cost: 250 })
    expect(updated).toHaveLength(1)
    expect(updated[0].cost).toBe(250)
    expect(updated[0].id).toBe(inserted[0].id)
    expect(syncLinkedExpense(updated, 's1', null)).toHaveLength(0)
  })
  it('syncLinkedExpense leaves unrelated expenses alone', () => {
    const other: Expense = { ...base, id: 'x' }
    expect(syncLinkedExpense([other], 's1', null)).toEqual([other])
  })
})

describe('backupStatus', () => {
  const now = new Date('2026-06-30T12:00:00Z')
  it('nudges after 7 days when never backed up', () => {
    expect(backupStatus({ installedAt: '2026-06-25T12:00:00Z' }, now)).toMatchObject({ never: true, days: 5, due: false })
    expect(backupStatus({ installedAt: '2026-06-20T12:00:00Z' }, now)).toMatchObject({ never: true, days: 10, due: true })
  })
  it('nudges after 30 days since the last backup', () => {
    expect(backupStatus({ installedAt: '2025-01-01T00:00:00Z', lastBackupAt: '2026-06-10T12:00:00Z' }, now)).toMatchObject({ never: false, days: 20, due: false })
    expect(backupStatus({ lastBackupAt: '2026-05-01T12:00:00Z' }, now).due).toBe(true)
  })
  it('does not nudge with no reference date', () => {
    expect(backupStatus({}, now).due).toBe(false)
  })
})

describe('csvEscape', () => {
  it('quotes values with commas, quotes and newlines', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('x\ny')).toBe('"x\ny"')
    expect(csvEscape(undefined)).toBe('')
  })
})

describe('migrate', () => {
  const v1 = { version: 1, vehicles: [veh()], maint: [], fuel: [], expenses: [], checklist: {}, activeVehicleId: 'v1', theme: 'light' }
  it('upgrades a v1 backup by adding services and parts', () => {
    const s = migrate(v1, new Date('2026-01-01T00:00:00Z'))
    expect(s?.version).toBe(2)
    expect(s?.services).toEqual([])
    expect(s?.parts).toEqual([])
    expect(s?.theme).toBe('light')
    expect(s?.installedAt).toBe('2026-01-01T00:00:00.000Z')
  })
  it('repairs a dangling activeVehicleId', () => {
    expect(migrate({ ...v1, activeVehicleId: 'gone' })?.activeVehicleId).toBe('v1')
  })
  it('rejects malformed input', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate('nope')).toBeNull()
    expect(migrate({ vehicles: [] })).toBeNull()
    expect(migrate({ ...v1, vehicles: [{ nickname: 'no id' }] })).toBeNull()
    expect(migrate({ ...v1, vehicles: [null] })).toBeNull()
  })
})
