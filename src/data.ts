import type { AppState, FuelLog, Expense, MaintItem, PartRecord, ServiceRecord, Vehicle, CodingDay, FuelType } from './types'
import { addDays, addMonths, uid } from './logic'

export const SCHEMA_VERSION = 2

/** Parts both kinds of vehicle have. */
const PARTS_COMMON = ['Battery', 'Tires', 'Spark Plugs', 'Starter Motor', 'Alternator', 'Belts']
/** Car-only parts: nothing here exists on a motorcycle (wipers, A/C, suspension arms, radiator hoses and so on). */
const PARTS_CAR = ['Front Brake Pads', 'Rear Brake Pads/Shoes', 'Shock Absorbers', 'Suspension Arms', 'Clutch Kit', 'Headlight/Bulbs', 'Wipers', 'Radiator/Hoses']
/** Motorcycle-only parts: chain and sprockets, CVT belt, fork seals and the like. */
const PARTS_MOTO = ['Front Tire', 'Rear Tire', 'Front Brake Pads', 'Rear Brake Pads/Shoes', 'Drive Chain & Sprockets', 'CVT Belt & Rollers', 'Clutch Kit', 'Shock Absorbers', 'Fork Seals & Oil', 'Headlight/Bulbs']

/** The part types to offer for a vehicle type, so a motorcycle is never asked about wipers and a car never about its chain. */
export function partTypesFor(type: 'car' | 'motorcycle'): string[] {
  const list = type === 'motorcycle' ? [...PARTS_COMMON.filter((p) => p !== 'Belts' && p !== 'Alternator'), ...PARTS_MOTO] : [...PARTS_COMMON, ...PARTS_CAR]
  return [...Array.from(new Set(list)), 'Other']
}
export const STORAGE_KEY = 'motogarage-ph'

export const CODING_DAYS: CodingDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Exempt']
export const FUEL_TYPES: FuelType[] = ['Diesel', 'Gasoline', 'Hybrid', 'EV']
/** Fuel types that exist for each kind of vehicle here: motorcycles run on gasoline (or are electric), never diesel or hybrid. */
export const fuelTypesFor = (type: 'car' | 'motorcycle'): FuelType[] => (type === 'motorcycle' ? ['Gasoline', 'EV'] : FUEL_TYPES)

interface Tpl { name: string; km?: number; mo?: number }

export const CAR_TEMPLATE: Tpl[] = [
  { name: 'Engine Oil & Oil Filter', km: 10000, mo: 6 },
  { name: 'Fuel Filter & Water Separator Check', km: 10000, mo: 12 },
  { name: 'Engine Air & Cabin A/C Filter', km: 15000, mo: 12 },
  { name: 'Tire Rotation & Alignment Check', km: 10000, mo: 6 },
  { name: 'Brake Pads, Rear Shoes & Fluid', km: 25000, mo: 24 },
  { name: 'Differential & Transmission Fluid', km: 40000, mo: 24 },
  { name: 'Coolant Flush & Drive Belt Inspection', km: 40000, mo: 36 },
]

export const MOTO_TEMPLATE: Tpl[] = [
  { name: 'Chain Clean, Lube & Slack Check', km: 500, mo: 1 },
  { name: 'Engine Oil & Strainer/Filter', km: 2000, mo: 3 },
  { name: 'Air Filter & Spark Plug', km: 6000, mo: 6 },
  { name: 'Brake Pads/Shoes & Fluid', km: 8000, mo: 12 },
  { name: 'Drive Chain & Sprocket Set', km: 15000, mo: 18 },
  { name: 'Front Fork Oil & Steering Head Bearing', km: 15000, mo: 18 },
  { name: 'Tires & Valve Clearance Check', km: 12000, mo: 12 },
]

export const CHECKLIST_CAR = [
  { key: 'battery', label: 'Battery', hint: 'Terminals clean & tight, no corrosion' },
  { key: 'lights', label: 'Lights', hint: 'Headlights, brake, signals, hazards' },
  { key: 'oil', label: 'Oil', hint: 'Dipstick between min and max' },
  { key: 'water', label: 'Water / Coolant', hint: 'Radiator, reservoir, wiper fluid' },
  { key: 'brakes', label: 'Brakes', hint: 'Firm pedal, handbrake holds' },
  { key: 'air', label: 'Air / Tire Pressure', hint: 'All four + spare at spec PSI' },
  { key: 'gas', label: 'Gas / Fuel', hint: 'Enough fuel for the trip' },
  { key: 'engine', label: 'Engine', hint: 'No warning lights, normal idle' },
  { key: 'tools', label: 'Tools', hint: 'Jack, wrench, spare, jumper cables' },
  { key: 'docs', label: 'OR/CR & License', hint: 'Registration, license, insurance' },
  { key: 'ewd', label: 'EWD', hint: 'Early warning device in the car' },
  { key: 'self', label: 'Self', hint: 'Rested, sober, seatbelt on' },
]

export const CHECKLIST_MOTO = [
  { key: 'battery', label: 'Battery', hint: 'Starts cleanly, terminals tight' },
  { key: 'lights', label: 'Lights', hint: 'Head, tail, brake, signals' },
  { key: 'oil', label: 'Oil', hint: 'Sight glass / dipstick level OK' },
  { key: 'water', label: 'Water / Coolant', hint: 'Coolant level (liquid-cooled bikes)' },
  { key: 'brakes', label: 'Brakes', hint: 'Lever & pedal firm, pads not worn' },
  { key: 'air', label: 'Air / Tire Pressure', hint: 'Front & rear PSI, tread, no cracks' },
  { key: 'gas', label: 'Gas / Fuel', hint: 'Enough fuel, no leaks' },
  { key: 'chain', label: 'Engine / Chain Slack', hint: 'Chain lubed, 20-30 mm slack' },
  { key: 'tools', label: 'Tools', hint: 'Basic tool kit, tire patch kit' },
  { key: 'docs', label: 'OR/CR & License', hint: 'Registration & license on hand' },
  { key: 'ewd', label: 'EWD / Rain Gear', hint: 'Reflective gear, raincoat' },
  { key: 'rider', label: 'Rider Check', hint: 'Helmet strap, gloves, jacket, boots' },
]

/**
 * What a first-time user starts with: nothing. No sample vehicles, so the dashboard only ever shows the user's own.
 * (The sample garage still exists as an explicit "Load sample garage" action, never added automatically.)
 */
export function buildEmptyState(): AppState {
  return {
    version: SCHEMA_VERSION, vehicles: [], maint: [], fuel: [], expenses: [], services: [], parts: [],
    checklist: {}, activeVehicleId: '', theme: 'system', installedAt: new Date().toISOString(),
  }
}

export function buildDemoState(today: string): AppState {
  const hilux: Vehicle = {
    id: uid(), type: 'car', nickname: '2018 Toyota Hilux G 4x2', make: 'Toyota', model: 'Hilux G 4x2', year: 2018,
    plate: 'NBC 1235', odometer: 78400, avgDailyKm: 35, codingDay: 'Wednesday', fuelType: 'Diesel',
    transmission: 'automatic', driving: { heavyTraffic: true, shortTrips: false, dusty: false, towing: false },
  }
  const moto: Vehicle = {
    id: uid(), type: 'motorcycle', nickname: 'Daily Commuter Motorcycle', make: 'Honda', model: 'Click 160', year: 2022,
    plate: '123 ABC', odometer: 18200, avgDailyKm: 25, codingDay: 'Exempt', fuelType: 'Gasoline',
    transmission: 'cvt', bikeType: 'scooter', engineCc: 160, driving: { heavyTraffic: true, shortTrips: false, dusty: false, towing: false },
  }

  const mk = (v: Vehicle, tpl: Tpl, lastKm: number, monthsAgo: number, extraDays = 0): MaintItem => ({
    id: uid(), vehicleId: v.id, name: tpl.name, intervalKm: tpl.km, intervalMonths: tpl.mo, lastServiceKm: lastKm,
    lastServiceDate: addDays(addMonths(today, -monthsAgo), -extraDays), source: 'custom',
  })

  const maint: MaintItem[] = [
    mk(hilux, CAR_TEMPLATE[0], 69000, 4),
    mk(hilux, CAR_TEMPLATE[1], 72000, 5),
    mk(hilux, CAR_TEMPLATE[2], 63000, 9),
    mk(hilux, CAR_TEMPLATE[3], 75000, 2),
    mk(hilux, CAR_TEMPLATE[4], 60000, 18),
    mk(hilux, CAR_TEMPLATE[5], 40000, 20),
    mk(hilux, CAR_TEMPLATE[6], 50000, 30),
    mk(moto, MOTO_TEMPLATE[0], 17800, 0, 21),
    mk(moto, MOTO_TEMPLATE[1], 17000, 2),
    mk(moto, MOTO_TEMPLATE[2], 11500, 5),
    mk(moto, MOTO_TEMPLATE[3], 12000, 7),
    mk(moto, MOTO_TEMPLATE[4], 5000, 13),
    mk(moto, MOTO_TEMPLATE[5], 3000, 16),
    mk(moto, MOTO_TEMPLATE[6], 10000, 8),
  ]

  const fills = (v: Vehicle, rows: [number, number, number, number, string][]): FuelLog[] =>
    rows.map(([ago, odo, liters, ppl, station]) => ({
      id: uid(), vehicleId: v.id, date: addDays(today, -ago), liters, pricePerLiter: ppl,
      totalCost: Math.round(liters * ppl * 100) / 100, odometer: odo, station, fullTank: true,
    }))

  const fuel: FuelLog[] = [
    ...fills(hilux, [
      [96, 75150, 52.0, 58.4, 'Petron'], [78, 75780, 54.2, 59.1, 'Shell'], [60, 76420, 56.8, 60.3, 'Caltex'],
      [43, 77010, 51.5, 61.0, 'Petron'], [26, 77650, 55.0, 60.2, 'Phoenix'], [8, 78290, 53.9, 59.8, 'Shell'],
    ]),
    ...fills(moto, [
      [40, 17010, 5.3, 64.9, 'Petron'], [32, 17235, 5.6, 65.4, 'Shell'], [24, 17450, 5.3, 66.0, 'Caltex'],
      [16, 17670, 5.5, 65.7, 'Petron'], [9, 17890, 5.4, 66.2, 'Phoenix'], [2, 18110, 5.5, 65.5, 'Shell'],
    ]),
  ]

  const ex = (v: Vehicle, ago: number, category: Expense['category'], cost: number, shopName: string, notes: string, odometer?: number): Expense => ({
    id: uid(), vehicleId: v.id, date: addDays(today, -ago), category, cost, shopName, notes, odometer,
  })
  const expenses: Expense[] = [
    ex(hilux, 120, 'PMS & Fluids', 4200, 'Toyota Service Center', 'Change oil + filter', 69000),
    ex(hilux, 70, 'Registration & Insurance', 6800, 'LTO / Insurer', 'Annual registration + CTPL'),
    ex(hilux, 45, 'Accessories & Detailing', 1500, 'Car Wash PH', 'Full detail + wax'),
    ex(hilux, 20, 'Wear & Tear Parts', 3200, 'Auto Parts Hub', 'Wiper blades + battery terminals'),
    ex(moto, 60, 'PMS & Fluids', 650, 'Moto Shop', 'Engine oil change', 17000),
    ex(moto, 30, 'Accessories & Detailing', 480, 'Moto Shop', 'Chain lube + brake cleaner'),
    ex(moto, 14, 'Repairs & Emergencies', 350, 'Vulcanizing', 'Rear tire patch'),
    ex(moto, 90, 'Registration & Insurance', 1200, 'LTO', 'Motorcycle registration'),
  ]

  const sv = (v: Vehicle, ago: number, name: string, odometer: number, cost: number, shopName: string): ServiceRecord => ({
    id: uid(), vehicleId: v.id, name, date: addDays(today, -ago), odometer, cost, shopName,
  })
  const services: ServiceRecord[] = [
    sv(hilux, 120, CAR_TEMPLATE[0].name, 69000, 4200, 'Toyota Service Center'),
    sv(hilux, 75, CAR_TEMPLATE[3].name, 75000, 1200, 'Alignment Pro'),
    sv(hilux, 300, CAR_TEMPLATE[2].name, 63000, 1800, 'Toyota Service Center'),
    sv(moto, 60, MOTO_TEMPLATE[1].name, 17000, 650, 'Moto Shop'),
    sv(moto, 21, MOTO_TEMPLATE[0].name, 17800, 120, 'Home'),
  ]

  const pt = (v: Vehicle, ago: number, p: Partial<PartRecord> & Pick<PartRecord, 'partType' | 'amount' | 'installedKm'>): PartRecord => ({
    id: uid(), vehicleId: v.id, condition: 'Brand New Original', description: '', brand: '', partNumber: '', shop: '',
    date: addDays(today, -ago), notes: '', ...p,
  })
  const parts: PartRecord[] = [
    pt(hilux, 200, { partType: 'Battery', brand: 'Motolite', description: 'NS70 maintenance-free', amount: 5400, installedKm: 71500, warrantyMonths: 18, shop: 'Motolite Center' }),
    pt(hilux, 150, { partType: 'Front Brake Pads', brand: 'Akebono', condition: 'Brand New Replacement', amount: 3100, installedKm: 73200, warrantyMonths: 6 }),
    pt(moto, 110, { partType: 'Rear Tire', brand: 'Michelin', description: '130/70-13', amount: 2800, installedKm: 16200, warrantyMonths: 12 }),
  ]

  return {
    version: SCHEMA_VERSION,
    vehicles: [hilux, moto],
    maint,
    fuel,
    expenses,
    services,
    parts,
    checklist: {},
    activeVehicleId: hilux.id,
    theme: 'system',
    installedAt: new Date().toISOString(),
  }
}
