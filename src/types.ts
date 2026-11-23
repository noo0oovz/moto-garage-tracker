export type VehicleType = 'car' | 'motorcycle'
export type FuelType = 'Diesel' | 'Gasoline' | 'Hybrid' | 'EV'
export type CodingDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Exempt'

export interface Vehicle {
  id: string
  type: VehicleType
  nickname: string
  make: string
  model: string
  year: number
  plate: string
  odometer: number
  avgDailyKm: number
  codingDay: CodingDay
  fuelType: FuelType
  /** The brand and grade this vehicle usually buys, so Fuel Watch can headline that price. Optional. */
  preferredFuel?: { brand: string; product: string }
  /**
   * The registration deadline (YYYY-MM-DD) of the renewal the user marked as done. Storing the deadline, not a
   * boolean, is what makes the tick expire by itself: next year's deadline is a different date, so it stops matching.
   */
  registeredFor?: string
  /** Manual, automatic, CVT or dual-clutch: changes which transmission fluid and how often. Cars (and some bikes). */
  transmission?: Transmission
  /** The kind of motorcycle (motorcycles only). Decides which maintenance schedule applies. */
  bikeType?: BikeType
  /** Engine size in cc (motorcycles): picks the maintenance class, from small scooters up to big bikes. */
  engineCc?: number
  /** How the vehicle is driven. "Severe use" shortens several intervals. */
  driving?: DrivingConditions
}

/** What kind of motorcycle: picks its maintenance schedule. Scooter = twist-and-go; small = up to about 150cc with gears; mid = about 200-400cc; big = over 400cc. */
export type BikeType = 'scooter' | 'small' | 'mid' | 'big'
export type Transmission = 'manual' | 'automatic' | 'cvt' | 'dct'
export interface DrivingConditions {
  heavyTraffic?: boolean
  shortTrips?: boolean
  dusty?: boolean
  towing?: boolean
}

export interface MaintItem {
  id: string
  vehicleId: string
  name: string
  intervalKm?: number
  intervalMonths?: number
  lastServiceKm: number
  lastServiceDate: string // YYYY-MM-DD
  /** Where the interval came from. 'booklet' means the owner copied it from her casa booklet and it is never overwritten. */
  source?: 'general' | 'booklet' | 'custom'
  /** The owner did not know when this was last done, so the dates are placeholders and the item is treated as due. */
  unknownLast?: boolean
  /** Key into the interval guide (src/intervals.ts), so the plain-language "why" can be shown for this item. */
  guideKey?: string
}

export interface FuelLog {
  id: string
  vehicleId: string
  date: string
  liters: number
  pricePerLiter: number
  totalCost: number
  odometer: number
  station: string
  fullTank: boolean
}

export const EXPENSE_CATEGORIES = [
  'Fuel',
  'PMS & Fluids',
  'Wear & Tear Parts',
  'Registration & Insurance',
  'Accessories & Detailing',
  'Repairs & Emergencies',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface Expense {
  id: string
  vehicleId: string
  date: string
  category: ExpenseCategory
  cost: number
  shopName: string
  notes: string
  odometer?: number
  /** id of the ServiceRecord / PartRecord that created this expense */
  sourceId?: string
}

export interface ServiceRecord {
  id: string
  vehicleId: string
  maintItemId?: string
  name: string
  date: string
  odometer: number
  cost?: number
  shopName?: string
  notes?: string
}

export const PART_CONDITIONS = ['Brand New Original', 'Brand New Replacement', 'Surplus / Used'] as const
export type PartCondition = (typeof PART_CONDITIONS)[number]

export interface PartRecord {
  id: string
  vehicleId: string
  partType: string
  condition: PartCondition
  description: string
  brand: string
  partNumber: string
  shop: string
  amount: number
  installedKm: number
  date: string
  warrantyMonths?: number
  notes: string
}

/** 'system' follows the device (light by day, dark by night); 'light' and 'dark' are the user's explicit choice. */
export type ThemeMode = 'system' | 'light' | 'dark'

export interface AppState {
  version: number
  vehicles: Vehicle[]
  maint: MaintItem[]
  fuel: FuelLog[]
  expenses: Expense[]
  services: ServiceRecord[]
  parts: PartRecord[]
  installedAt?: string // ISO timestamp, baseline for the backup reminder
  lastBackupAt?: string // ISO timestamp of the last JSON export/import
  checklist: Record<string, string[]> // vehicleId -> checked keys
  activeVehicleId: string
  theme: ThemeMode
}

export type Page = 'garage' | 'logs' | 'checklist' | 'more' | 'vehicles' | 'settings' | 'fuel' | 'history' | 'parts' | 'fuelwatch'
