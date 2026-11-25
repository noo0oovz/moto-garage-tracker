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

export type OverallLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unchecked' | 'none'

export interface OverallHealth {
  /** 0-100, higher is healthier. Null when there is nothing to judge. */
  score: number | null
  level: OverallLevel
  total: number
  healthy: number
  dueSoon: number
  overdue: number
  /** Items whose last service the owner does not know. They count as due, but the score should say that is a precaution. */
  unknown: number
  /** The item most in need of attention (highest share of its life used), if any needs it. */
  worst?: { name: string; status: Status; pct: number }
}

/**
 * What one item contributes to the vehicle's score. Built from the item's STATUS, the same thing its badge shows, so
 * the score always agrees with the cards beneath it:
 *  - healthy: 100 down to ~70 as it wears (a part at 83% used is fine but not as good as a fresh one);
 *  - due soon (85-100% used): 60 down to 30;
 *  - overdue: 0.
 * Scoring raw "remaining life" instead would make a well-kept vehicle look terrible, because most parts spend most of
 * their life well used while still being perfectly healthy.
 */
export function itemPoints(h: Pick<Health, 'status' | 'pct'>): number {
  const pct = Number.isFinite(h.pct) ? Math.max(0, Math.min(100, h.pct)) : 0
  if (h.status === 'Overdue') return 0
  if (h.status === 'Due Soon') return Math.max(30, 60 - Math.max(0, pct - 85) * 2)
  return 100 - Math.min(pct, 85) * 0.35
}

/**
 * One number for "how is this vehicle doing".
 *
 * A plain average hides problems: six fresh items would average out one badly overdue drive belt and call the vehicle
 * fine. So the total is a blend of the average item score and the WEAKEST item (a quarter): an overdue item visibly
 * drags the vehicle down instead of being averaged away. The label comes from the item statuses, so any overdue item
 * keeps the vehicle out of "good" however healthy the rest is.
 */
export function overallHealth(items: { name: string; h: Health; unknown?: boolean }[]): OverallHealth {
  const total = items.length
  // Items whose last service nobody knows cannot be judged. They are NOT counted as overdue (we do not know that), and
  // they are left out of the score, but they can never look healthy: they cap the label below "excellent" and are
  // reported separately so the card can say "let's check these" instead of "14 overdue".
  const known = items.filter((i) => !i.unknown)
  const unknown = total - known.length
  const counts = { healthy: 0, dueSoon: 0, overdue: 0 }
  for (const { h } of known) {
    if (h.status === 'Healthy') counts.healthy++
    else if (h.status === 'Due Soon') counts.dueSoon++
    else counts.overdue++
  }
  if (!total) return { score: null, level: 'none', total, unknown, ...counts }
  if (!known.length) return { score: null, level: 'unchecked', total, unknown, ...counts }
  const pts = known.map(({ h }) => itemPoints(h))
  const avg = pts.reduce((x, y) => x + y, 0) / known.length
  const min = Math.min(...pts)
  const score = Math.round(Math.max(0, Math.min(100, avg * 0.75 + min * 0.25)))
  // The label comes from item STATUSES, not a score threshold. Any overdue item is at least "fair"; a third or more of
  // the known items overdue, or two-plus overdue, is "poor". Unknown items hold the label at "good" at best.
  const kn = known.length
  // "Poor" is a verdict on the whole vehicle, so it needs real evidence. With most items unknown, a single overdue item
  // among a couple of known ones must not be read as "several overdue / needs service": at worst it needs attention.
  const enoughToJudge = kn >= 4 || kn >= total * 0.6
  let level: OverallLevel =
    counts.overdue > 0 ? (enoughToJudge && (counts.overdue >= 2 || counts.overdue / kn >= 1 / 3) ? 'poor' : 'fair')
    : counts.dueSoon > 0 ? (counts.dueSoon / kn > 0.5 ? 'fair' : 'good')
    : 'excellent'
  if (unknown > 0 && level === 'excellent') level = 'good'
  const needy = known.filter(({ h }) => h.status !== 'Healthy').sort((a, b) => b.h.pct - a.h.pct)[0]
  return { score, level, total, unknown, ...counts, worst: needy ? { name: needy.name, status: needy.h.status, pct: needy.h.pct } : undefined }
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
    : v.fuelType === 'EV' || v.fuelType === 'Hybrid' ? `${v.fuelType} vehicles are currently exempt from UVVRP coding (the exemption runs until 2030).`
    : null
  const coding = v.codingDay as CodingDay
  if (coding === 'Exempt' || exemptReason) {
    return { state: 'exempt' as const, label: 'Exempt from coding', note: exemptReason ?? 'This vehicle is marked exempt.', today }
  }
  if (weekend) return { state: 'free' as const, label: `No coding on ${today}`, note: 'UVVRP applies Monday to Friday only.', today }
  if (coding === today) {
    return {
      state: 'coding' as const, label: `Coding today (${today})`,
      note: 'Typically 7:00-10:00 AM and 5:00-8:00 PM, Monday to Friday, in Metro Manila (MMDA); some cities differ. Check current advisories.', today,
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

/** One limit of an interval (distance or time), ready to show: the words, and whether it has already been passed. */
export interface Limit { label: string; over: boolean; known: boolean }

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** "about 3 months" for long spans, otherwise days. Never says "NaN" or a negative number. */
export function spanLabel(days: number, short = false): string {
  const d = Math.abs(Math.round(days))
  // the short form is for list rows, where room is tight: "6 mo", "3 wk", "12 d"
  if (d >= 60) return short ? `${Math.round(d / 30)} mo` : `about ${plural(Math.round(d / 30), 'month')}`
  if (d >= 14) return short ? `${Math.round(d / 7)} wk` : `about ${plural(Math.round(d / 7), 'week')}`
  return short ? `${d} d` : plural(d, 'day')
}

/**
 * The two limits of an interval as plain words: how far (km) and how long (time) are left, or how far past they are.
 * Either is `known: false` when the item has no such limit, so the screen can leave it out instead of printing a dash.
 */
export function limits(h: Pick<Health, 'kmRemaining' | 'daysRemaining'>, short = false): { km: Limit; time: Limit } {
  const km: Limit = h.kmRemaining === undefined || !Number.isFinite(h.kmRemaining)
    ? { label: '', over: false, known: false }
    : h.kmRemaining < 0 ? { label: `${num(-h.kmRemaining)} km over`, over: true, known: true } : { label: `${num(h.kmRemaining)} km left`, over: false, known: true }
  const time: Limit = h.daysRemaining === undefined || !Number.isFinite(h.daysRemaining)
    ? { label: '', over: false, known: false }
    : h.daysRemaining < 0 ? { label: `${spanLabel(h.daysRemaining, short)} over`, over: true, known: true } : { label: `${spanLabel(h.daysRemaining, short)} left`, over: false, known: true }
  return { km, time }
}

/**
 * Which limit to headline for an item: the one that runs out first. Distance is turned into days using the vehicle's
 * daily distance, so the two can be compared fairly; with no daily figure, distance is preferred when both exist.
 */
export function headlineLimit(m: Pick<MaintItem, 'intervalKm' | 'intervalMonths' | 'lastServiceDate'>, h: Pick<Health, 'kmRemaining' | 'daysRemaining' | 'dueDate'>, avgDailyKm: number, today = todayISO()): 'km' | 'time' | 'none' {
  const hasKm = h.kmRemaining !== undefined && Number.isFinite(h.kmRemaining)
  const hasTime = !!m.intervalMonths && !!h.dueDate && Number.isFinite(daysBetween(today, h.dueDate))
  if (hasKm && !hasTime) return 'km'
  if (hasTime && !hasKm) return 'time'
  if (!hasKm && !hasTime) return 'none'
  const kmDays = avgDailyKm > 0 ? (h.kmRemaining as number) / avgDailyKm : Infinity
  const timeDays = daysBetween(today, h.dueDate as string)
  if (!Number.isFinite(kmDays)) return 'km'
  return kmDays <= timeDays ? 'km' : 'time'
}

/**
 * The single status line for a maintenance row, which replaces a separate "Overdue" badge, so it has to say on its own
 * whether the item is late: "2 days over", "400 km over", "1,600 km left", "about 6 weeks left".
 *  - If a limit has been passed, that is the news, so it is the one shown (distance first if both are).
 *  - Otherwise the limit that runs out first is shown.
 * The time figure comes from the real calendar due date, not from `daysRemaining`, which also folds in the distance limit.
 */
export function rowStatus(
  m: Pick<MaintItem, 'intervalKm' | 'intervalMonths' | 'lastServiceDate'>,
  h: Pick<Health, 'kmRemaining' | 'daysRemaining' | 'dueDate'>,
  avgDailyKm: number,
  today = todayISO(),
  short = true,
): { text: string; over: boolean } {
  const km = limits({ kmRemaining: h.kmRemaining }, short).km
  const calendarDays = m.intervalMonths && h.dueDate ? daysBetween(today, h.dueDate) : undefined
  const time = limits({ daysRemaining: calendarDays }, short).time
  const over = km.over || time.over
  if (km.over) return { text: km.label, over }
  if (time.over) return { text: time.label, over }
  const pick = headlineLimit(m, h, avgDailyKm, today)
  const shown = pick === 'time' ? time : pick === 'km' ? km : km.known ? km : time
  return { text: shown.known ? shown.label : '', over }
}
