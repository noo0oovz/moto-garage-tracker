import type { CodingDay, Expense, FuelLog, MaintItem, ServiceRecord, Vehicle } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const peso = (n: number, dec = 0) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export const num = (n: number, dec = 0) => n.toLocaleString('en-PH', { maximumFractionDigits: dec })

function pad(n: number) { return String(n).padStart(2, '0') }
export function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export function todayISO() { return toISO(new Date()) }
/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-30, "garbage", ""). */
export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(y, m - 1, d)
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d
}
/** Parse YYYY-MM-DD as a local date. Anything that is not a real date yields an Invalid Date (never a silent rollover). */
export function parseISO(s: string) {
  if (!isISODate(s)) return new Date(NaN)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s: string, n: number) {
  const d = parseISO(s)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export function addMonths(s: string, n: number) {
  const d = parseISO(s)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}
export function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
}
export function fmtDate(s: string) {
  const d = parseISO(s)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export type Status = 'Healthy' | 'Due Soon' | 'Overdue'

export interface Health {
  status: Status
  pct: number // 0-100 used life
  kmRemaining?: number
  daysRemaining?: number // limiting estimate (min of km-based and date-based)
  dueDate?: string
}

export function maintHealth(m: MaintItem, v: Vehicle, today = todayISO()): Health {
  const fracs: number[] = []
  let kmRemaining: number | undefined
  let daysByKm: number | undefined
  let daysByDate: number | undefined
  if (m.intervalKm && m.intervalKm > 0) {
    // An odometer below the last-service reading is a typo, not negative wear: count it as no distance used.
    const used = Math.max(0, v.odometer - m.lastServiceKm)
    kmRemaining = m.intervalKm - used
    fracs.push(used / m.intervalKm)
    if (v.avgDailyKm > 0) daysByKm = Math.floor(kmRemaining / v.avgDailyKm)
  }
  let dueDate: string | undefined
  if (m.intervalMonths && m.intervalMonths > 0) {
    // An unreadable service date means the time limit is unknown: skip it rather than show "NaN days".
    const due = addMonths(m.lastServiceDate, m.intervalMonths)
    const total = due ? daysBetween(m.lastServiceDate, due) : NaN
    const elapsed = due ? daysBetween(m.lastServiceDate, today) : NaN
    if (Number.isFinite(total) && Number.isFinite(elapsed)) {
      dueDate = due
      daysByDate = total - elapsed
      fracs.push(total > 0 ? elapsed / total : 1)
    }
  }
  const frac = fracs.length ? Math.max(...fracs) : 0
  const cands = [daysByKm, daysByDate].filter((x): x is number => x !== undefined)
  const daysRemaining = cands.length ? Math.min(...cands) : undefined
  const status: Status = frac >= 1 ? 'Overdue' : frac >= 0.85 ? 'Due Soon' : 'Healthy'
  return { status, pct: Math.max(0, Math.min(100, frac * 100)), kmRemaining, daysRemaining, dueDate }
}

export const statusColor: Record<Status, { bar: string; badge: string }> = {
  Healthy: { bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  'Due Soon': { bar: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  Overdue: { bar: 'bg-red-500', badge: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}

export function fuelEfficiency(logs: FuelLog[]) {
  // km/L between consecutive full-tank fill-ups: distance / liters of the later fill-up
  // (plus any partial fills in between).
  const sorted = [...logs].sort((a, b) => a.odometer - b.odometer)
  const segments: { id: string; kmPerL: number }[] = []
  let anchor: FuelLog | null = null
  let litersSince = 0
  for (const l of sorted) {
    if (!anchor) {
      if (l.fullTank) anchor = l
      continue
    }
    litersSince += l.liters
    if (l.fullTank) {
      const km = l.odometer - anchor.odometer
      if (km > 0 && litersSince > 0) segments.push({ id: l.id, kmPerL: km / litersSince })
      anchor = l
      litersSince = 0
    }
  }
  const avg = segments.length ? segments.reduce((s, x) => s + x.kmPerL, 0) / segments.length : null
  const map: Record<string, number> = {}
  segments.forEach((s) => (map[s.id] = s.kmPerL))
  return { avg, last: segments.length ? segments[segments.length - 1].kmPerL : null, map }
}

export interface LedgerRow {
  id: string
  kind: 'fuel' | 'expense'
  date: string
  category: string
  desc: string
  place: string
  odometer?: number
  cost: number
  kmPerL?: number
}

export function buildLedger(fuel: FuelLog[], expenses: Expense[], vehicleId: string): LedgerRow[] {
  const f = fuel.filter((x) => x.vehicleId === vehicleId)
  const eff = fuelEfficiency(f)
  const rows: LedgerRow[] = [
    ...f.map<LedgerRow>((x) => ({
      id: x.id, kind: 'fuel', date: x.date, category: 'Fuel',
      desc: `${num(x.liters, 2)} L @ ${peso(x.pricePerLiter, 2)}${x.fullTank ? ' · full' : ''}`,
      place: x.station, odometer: x.odometer, cost: x.totalCost, kmPerL: eff.map[x.id],
    })),
    ...expenses.filter((x) => x.vehicleId === vehicleId).map<LedgerRow>((x) => ({
      id: x.id, kind: 'expense', date: x.date, category: x.category, desc: x.notes, place: x.shopName,
      odometer: x.odometer, cost: x.cost,
    })),
  ]
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function spendSummary(rows: LedgerRow[], odometerSpan: number, today = todayISO()) {
  const month = today.slice(0, 7)
  const all = rows.reduce((s, r) => s + r.cost, 0)
  const thisMonth = rows.filter((r) => r.date.startsWith(month)).reduce((s, r) => s + r.cost, 0)
  const byCat: Record<string, number> = {}
  rows.forEach((r) => (byCat[r.category] = (byCat[r.category] || 0) + r.cost))
  return { all, thisMonth, byCat, perKm: odometerSpan > 0 ? all / odometerSpan : null }
}

// Cost-per-km uses the odometer range covered by logged records.
export function loggedKmSpan(fuel: FuelLog[], expenses: Expense[], vehicleId: string) {
  const odos = [
    ...fuel.filter((f) => f.vehicleId === vehicleId).map((f) => f.odometer),
    ...expenses.filter((e) => e.vehicleId === vehicleId && e.odometer).map((e) => e.odometer as number),
  ]
  return odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : 0
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export function codingStatus(v: Vehicle, date = new Date()) {
  const today = DAY_NAMES[date.getDay()]
  const weekend = date.getDay() === 0 || date.getDay() === 6
  const exemptReason =
    v.type === 'motorcycle' ? 'Motorcycles are generally exempt from UVVRP coding.'
    : v.fuelType === 'EV' || v.fuelType === 'Hybrid' ? `${v.fuelType} vehicles are generally exempt from UVVRP coding.`
    : null
  const coding = v.codingDay as CodingDay
  if (coding === 'Exempt' || exemptReason) {
    return { state: 'exempt' as const, label: 'Exempt from coding', note: exemptReason ?? 'This vehicle is marked exempt.', today }
  }
  if (weekend) return { state: 'free' as const, label: `No coding on ${today}`, note: 'UVVRP applies Monday to Friday only.', today }
  if (coding === today) {
    return {
      state: 'coding' as const, label: `Coding today (${today})`,
      note: 'Typically 7:00-10:00 AM and 3:00-8:00 PM in Metro Manila (MMDA); LGUs may differ. Verify advisories.', today,
    }
  }
  return { state: 'free' as const, label: `Free to drive today`, note: `Your coding day is ${coding}. Today is ${today}.`, today }
}

export function inRange(date: string, days: number | null, today = todayISO()) {
  return days === null || date >= addDays(today, -days)
}

export function warrantyInfo(p: { date: string; warrantyMonths?: number }, today = todayISO()) {
  if (!p.warrantyMonths) return null
  const end = addMonths(p.date, p.warrantyMonths)
  const days = daysBetween(today, end)
  return { end, days, active: days >= 0 }
}

/** Latest service record for a maintenance item (by date, then odometer). */
export function latestService(services: ServiceRecord[], maintItemId?: string) {
  if (!maintItemId) return undefined
  return services
    .filter((s) => s.maintItemId === maintItemId)
    .sort((a, b) => (a.date === b.date ? b.odometer - a.odometer : a.date < b.date ? 1 : -1))[0]
}

/** Insert, update or remove the expense linked (via sourceId) to a part/service record. */
export function syncLinkedExpense(
  expenses: Expense[],
  sourceId: string,
  next: Omit<Expense, 'id' | 'sourceId'> | null,
): Expense[] {
  if (!next) return expenses.filter((x) => x.sourceId !== sourceId)
  if (expenses.some((x) => x.sourceId === sourceId)) {
    return expenses.map((x) => (x.sourceId === sourceId ? { ...x, ...next } : x))
  }
  return [...expenses, { ...next, id: uid(), sourceId }]
}

export interface BackupStatus { days: number | null; never: boolean; due: boolean }

/** Nudge after 7 days if never backed up, otherwise after 30 days since the last backup. */
export function backupStatus(s: { installedAt?: string; lastBackupAt?: string }, now = new Date()): BackupStatus {
  const never = !s.lastBackupAt
  const ref = s.lastBackupAt ?? s.installedAt
  const t = ref ? new Date(ref).getTime() : NaN
  if (!Number.isFinite(t)) return { days: null, never, due: false }
  const days = Math.max(0, Math.floor((now.getTime() - t) / 86400000))
  return { days, never, due: days >= (never ? 7 : 30) }
}

export function csvEscape(v: unknown) {
  let s = v === undefined || v === null ? '' : String(v)
  // Spreadsheet formula injection: a text cell starting with = + - @ (or tab/CR) runs as a formula in Excel/Sheets.
  // Real numbers such as -5 are legitimate; only free text is prefixed with an apostrophe so it stays inert.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
