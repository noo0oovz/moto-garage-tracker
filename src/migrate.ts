import type { AppState, Expense, FuelLog, MaintItem, PartRecord, ServiceRecord, Vehicle } from './types'
import { EXPENSE_CATEGORIES, PART_CONDITIONS } from './types'
import { SCHEMA_VERSION } from './data'
import { isISODate } from './logic'
import { isProduct } from './pricing'
import { cleanView, isPhoto } from './photo'
import { GUIDE } from './intervals'

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : typeof x === 'number' && Number.isFinite(x) ? String(x) : d)
/** Largest value accepted for any stored number (a billion: far beyond a real odometer, cost or tank). Same as the forms' limit in ui.tsx. */
const MAX_VALUE = 1e9
/** A finite number, or the fallback. Rejects NaN/Infinity/"12abc"; accepts numeric strings such as "12.5". */
const nz = (x: unknown, d = 0) => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN
  // Finite AND sane: values near the float limit are corrupt data, and a few of them added together overflow to Infinity.
  return Number.isFinite(n) && Math.abs(n) <= MAX_VALUE ? n : d
}
const opt = (x: unknown) => { const n = nz(x, NaN); return Number.isFinite(n) ? n : undefined }
const date = (x: unknown, d: string) => (isISODate(x) ? x : d)
const oneOf = <T extends string>(x: unknown, list: readonly T[], d: T): T => (typeof x === 'string' && (list as readonly string[]).includes(x) ? (x as T) : d)

const TRANSMISSIONS = ['manual', 'automatic', 'cvt', 'dct'] as const
const CODING = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Exempt'] as const
const FUELS = ['Diesel', 'Gasoline', 'Hybrid', 'EV'] as const
const BIKE_TYPES = ['scooter', 'small', 'mid', 'big'] as const

/** Keep the first record for each id; records with a missing id are dropped. */
function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((x) => { if (!x.id || seen.has(x.id)) return false; seen.add(x.id); return true })
}

/**
 * Validate and upgrade stored/imported data to the current schema.
 *
 * The backup file is the one place untrusted or hand-edited data enters the app, so every record is checked and
 * repaired rather than trusted: numbers are coerced (NaN never reaches a total), enums are restricted, duplicate
 * ids and records whose vehicle no longer exists are dropped. Returns null when the input is not a MotoGarage state.
 */
export function migrate(raw: unknown, now = new Date(), today = now.toISOString().slice(0, 10)): AppState | null {
  if (!isObj(raw)) return null
  const s = raw
  if (!Array.isArray(s.vehicles) || !Array.isArray(s.maint) || !Array.isArray(s.fuel) || !Array.isArray(s.expenses)) return null
  if (s.vehicles.some((v) => !isObj(v) || typeof v.id !== 'string' || !v.id)) return null

  const vehicles: Vehicle[] = uniqueById(
    (s.vehicles as Record<string, unknown>[]).map((v) => ({
      id: String(v.id),
      type: oneOf(v.type, ['car', 'motorcycle'] as const, 'car'),
      nickname: str(v.nickname, 'Vehicle'), make: str(v.make), model: str(v.model),
      year: Math.round(nz(v.year, new Date().getFullYear())), plate: str(v.plate),
      odometer: Math.max(0, nz(v.odometer)), avgDailyKm: Math.max(0, nz(v.avgDailyKm, 30)),
      codingDay: oneOf(v.codingDay, CODING, 'Exempt'), fuelType: oneOf(v.fuelType, FUELS, 'Gasoline'),
      preferredFuel: isObj(v.preferredFuel) && typeof v.preferredFuel.brand === 'string' && v.preferredFuel.brand && isProduct(v.preferredFuel.product)
        ? { brand: v.preferredFuel.brand, product: v.preferredFuel.product } : undefined,
      registeredFor: isISODate(v.registeredFor) ? v.registeredFor : undefined,
      photo: isPhoto(v.photo) ? v.photo : undefined,
      // a framing means nothing without its photo
      photoView: isPhoto(v.photo) ? cleanView(v.photoView) : undefined,
      // Only motorcycles have a bike type; anything unrecognised is left unset and the engine size decides instead.
      bikeType: v.type === 'motorcycle' && typeof v.bikeType === 'string' && (BIKE_TYPES as readonly string[]).includes(v.bikeType) ? (v.bikeType as (typeof BIKE_TYPES)[number]) : undefined,
      transmission: typeof v.transmission === 'string' && (TRANSMISSIONS as readonly string[]).includes(v.transmission) ? (v.transmission as (typeof TRANSMISSIONS)[number]) : undefined,
      // Engine size: a believable number of cc only (a typo like 1e9 must not pick a class by accident).
      engineCc: opt(v.engineCc) && (opt(v.engineCc) as number) >= 20 && (opt(v.engineCc) as number) <= 3000 ? Math.round(opt(v.engineCc) as number) : undefined,
      driving: isObj(v.driving) ? {
        heavyTraffic: v.driving.heavyTraffic === true, shortTrips: v.driving.shortTrips === true,
        dusty: v.driving.dusty === true, towing: v.driving.towing === true,
      } : undefined,
    })),
  )
  const ids = new Set(vehicles.map((v) => v.id))
  const rows = <T>(list: unknown): Record<string, unknown>[] => (Array.isArray(list) ? list.filter(isObj).filter((r) => ids.has(String(r.vehicleId))) : []) as Record<string, unknown>[] & T[]

  const maint: MaintItem[] = uniqueById(rows<MaintItem>(s.maint).map((m) => ({
    id: str(m.id), vehicleId: String(m.vehicleId), name: str(m.name, 'Item'),
    intervalKm: opt(m.intervalKm) && (opt(m.intervalKm) as number) > 0 ? opt(m.intervalKm) : undefined,
    intervalMonths: opt(m.intervalMonths) && (opt(m.intervalMonths) as number) > 0 ? opt(m.intervalMonths) : undefined,
    lastServiceKm: Math.max(0, nz(m.lastServiceKm)), lastServiceDate: date(m.lastServiceDate, today),
    source: oneOf(m.source, ['general', 'booklet', 'custom'] as const, 'custom'),
    unknownLast: m.unknownLast === true ? true : undefined,
    neverDone: m.neverDone === true && m.unknownLast !== true ? true : undefined,
    guideKey: typeof m.guideKey === 'string' && m.guideKey in GUIDE ? m.guideKey : undefined,
  })))
  const fuel: FuelLog[] = uniqueById(rows<FuelLog>(s.fuel).map((f) => ({
    id: str(f.id), vehicleId: String(f.vehicleId), date: date(f.date, today), liters: Math.max(0, nz(f.liters)),
    pricePerLiter: Math.max(0, nz(f.pricePerLiter)), totalCost: Math.max(0, nz(f.totalCost)), odometer: Math.max(0, nz(f.odometer)),
    station: str(f.station), fullTank: f.fullTank === true,
  })))
  const expenses: Expense[] = uniqueById(rows<Expense>(s.expenses).map((e) => ({
    id: str(e.id), vehicleId: String(e.vehicleId), date: date(e.date, today), category: oneOf(e.category, EXPENSE_CATEGORIES, 'Repairs & Emergencies'),
    cost: Math.max(0, nz(e.cost)), shopName: str(e.shopName), notes: str(e.notes), odometer: opt(e.odometer), sourceId: typeof e.sourceId === 'string' ? e.sourceId : undefined,
  })))
  // v1 -> v2: service history and parts ledger were added.
  const services: ServiceRecord[] = uniqueById(rows<ServiceRecord>(s.services).map((r) => ({
    id: str(r.id), vehicleId: String(r.vehicleId), maintItemId: typeof r.maintItemId === 'string' ? r.maintItemId : undefined, name: str(r.name, 'Service'),
    date: date(r.date, today), odometer: Math.max(0, nz(r.odometer)), cost: opt(r.cost), shopName: str(r.shopName) || undefined, notes: str(r.notes) || undefined,
  })))
  const parts: PartRecord[] = uniqueById(rows<PartRecord>(s.parts).map((p) => ({
    id: str(p.id), vehicleId: String(p.vehicleId), partType: str(p.partType, 'Other'), condition: oneOf(p.condition, PART_CONDITIONS, 'Brand New Original'),
    description: str(p.description), brand: str(p.brand), partNumber: str(p.partNumber), shop: str(p.shop), amount: Math.max(0, nz(p.amount)),
    installedKm: Math.max(0, nz(p.installedKm)), date: date(p.date, today), warrantyMonths: opt(p.warrantyMonths), notes: str(p.notes),
  })))

  const checklist: Record<string, string[]> = {}
  if (isObj(s.checklist)) for (const [k, v] of Object.entries(s.checklist)) if (ids.has(k) && Array.isArray(v)) checklist[k] = v.filter((x): x is string => typeof x === 'string')

  const active = typeof s.activeVehicleId === 'string' && ids.has(s.activeVehicleId) ? s.activeVehicleId : (vehicles[0]?.id ?? '')
  return {
    version: SCHEMA_VERSION, vehicles, maint, fuel, expenses, services, parts, checklist, activeVehicleId: active,
    // An explicit choice is kept exactly. Anything else (a first run, a missing or unknown value) follows the device.
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    installedAt: typeof s.installedAt === 'string' ? s.installedAt : now.toISOString(),
    lastBackupAt: typeof s.lastBackupAt === 'string' ? s.lastBackupAt : undefined,
  }
}
