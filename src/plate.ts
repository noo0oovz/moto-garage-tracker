// Philippine plate rules: number coding (UVVRP) and the registration renewal schedule.
import type { CodingDay, Vehicle, VehicleType } from './types'

/** The last digit of a plate, ignoring letters, spaces and punctuation ("NBC 1234" -> 4, "1234 AB" -> 4). */
export function lastDigit(plate: string): number | null {
  const digits = (plate ?? '').replace(/\D/g, '')
  return digits ? Number(digits[digits.length - 1]) : null
}

/** The digit before the last one ("NBC 1234" -> 3). Null when the plate has fewer than two digits. */
export function secondLastDigit(plate: string): number | null {
  const digits = (plate ?? '').replace(/\D/g, '')
  return digits.length >= 2 ? Number(digits[digits.length - 2]) : null
}

/**
 * MMDA number coding (UVVRP), Metro Manila: 1-2 Monday, 3-4 Tuesday, 5-6 Wednesday, 7-8 Thursday, 9-0 Friday.
 * Source: MMDA scheme as summarised at https://en.wikipedia.org/wiki/Number_coding_in_the_Philippines
 */
const CODING_BY_DIGIT: Record<number, CodingDay> = {
  1: 'Monday', 2: 'Monday', 3: 'Tuesday', 4: 'Tuesday', 5: 'Wednesday', 6: 'Wednesday', 7: 'Thursday', 8: 'Thursday', 9: 'Friday', 0: 'Friday',
}

/**
 * The coding day a new or edited vehicle should get.
 *  - motorcycles are not subject to number coding, so they are always Exempt;
 *  - cars follow the last digit of the plate;
 *  - a car with no digit in its plate yet has no scheme to apply, so it stays Exempt until a plate is entered.
 */
export function codingDayFor(type: VehicleType, plate: string): CodingDay {
  if (type === 'motorcycle') return 'Exempt'
  const d = lastDigit(plate)
  return d === null ? 'Exempt' : CODING_BY_DIGIT[d]
}

// ---- Registration renewal ----------------------------------------------------------------------
/**
 * LTO renewal month by the LAST digit of the plate (1 = January ... 9 = September, 0 = October).
 *
 * NOT VERIFIED against an LTO source: lto.gov.ph blocks automated access and no secondary source could be read while
 * building this. The month rule below is the commonly published one; confirm it with LTO before relying on it.
 * It is kept in this one table so a correction is a one-line change, and the app labels the result as an estimate.
 */
export const RENEWAL_MONTH_BY_DIGIT: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 0: 10 }

export interface RenewalInfo {
  /** Calendar month 1-12 the plate renews in. */
  month: number
  /** Deadline: the last day of that month, in `year`. */
  deadline: string
  daysLeft: number
  status: 'ok' | 'soon' | 'due' | 'overdue'
  /** True when the user marked this exact deadline as already registered. */
  registered: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The next registration deadline on or after `today`, as an estimate: the last day of the renewal month for the
 * plate's last digit. (LTO also assigns working-day windows within that month by the second-to-last digit; those
 * are intentionally not guessed - the month's last day is the outer limit.)
 */
export function nextRenewal(plate: string, type: VehicleType, today: string, registeredFor?: string): RenewalInfo | null {
  const d = lastDigit(plate)
  if (d === null || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  void type // same month rule for cars and motorcycles; kept so a per-type rule is a local change
  const month = RENEWAL_MONTH_BY_DIGIT[d]
  const [y, m, day] = today.split('-').map(Number)
  const endOf = (year: number) => `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
  // This year's deadline if it hasn't passed; otherwise next year's. A deadline that was missed this year is
  // reported as overdue (for the month still running or a month past) rather than silently rolled forward.
  let deadline = endOf(y)
  if (deadline < today) {
    // within 30 days after the deadline: still show it as overdue instead of jumping to next year
    const lastDay = new Date(y, month, 0).getDate()
    const daysPast = Math.round((new Date(y, m - 1, day).getTime() - new Date(y, month - 1, lastDay).getTime()) / 86400000)
    if (daysPast > 30) deadline = endOf(y + 1)
  }
  const daysLeft = Math.round((new Date(Number(deadline.slice(0, 4)), Number(deadline.slice(5, 7)) - 1, Number(deadline.slice(8))).getTime() - new Date(y, m - 1, day).getTime()) / 86400000)
  const status = daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'due' : daysLeft <= 30 ? 'soon' : 'ok'
  return { month, deadline, daysLeft, status, registered: !!registeredFor && registeredFor === deadline }
}

/**
 * How loudly to remind. A deadline the user marked as done is silent; one more than 30 days away is just information
 * (shown quietly, so a far-off deadline is still visible instead of looking like a missing feature).
 */
export type ReminderLevel = 'none' | 'info' | 'soon' | 'due' | 'overdue'
export function reminderLevel(r: Pick<RenewalInfo, 'status' | 'registered'>): ReminderLevel {
  if (r.registered) return 'none'
  return r.status === 'ok' ? 'info' : r.status
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** True when the stored coding day was derived from the plate (so editing the plate may safely update it). */
export function codingIsAuto(v: Pick<Vehicle, 'type' | 'plate' | 'codingDay'>): boolean {
  return v.codingDay === codingDayFor(v.type, v.plate)
}
