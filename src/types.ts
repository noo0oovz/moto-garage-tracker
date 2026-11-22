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
}

export interface MaintItem {
  id: string
  vehicleId: string
  name: string
  intervalKm?: number
  intervalMonths?: number
  lastServiceKm: number
  lastServiceDate: string // YYYY-MM-DD
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

export type ThemeMode = 'dark' | 'light'

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

export type Page = 'garage' | 'logs' | 'checklist' | 'more' | 'vehicles' | 'settings' | 'fuel' | 'history' | 'parts'
