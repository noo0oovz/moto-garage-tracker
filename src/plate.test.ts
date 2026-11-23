import { describe, expect, it } from 'vitest'
import { codingDayFor, codingIsAuto, lastDigit, nextRenewal, secondLastDigit } from './plate'

describe('plate digits', () => {
  it('reads the last digit regardless of letters, spaces and dashes', () => {
    expect(lastDigit('NBC 1234')).toBe(4)
    expect(lastDigit('NBC-1234')).toBe(4)
    expect(lastDigit('1234 AB')).toBe(4) // old motorcycle format: digits then letters
    expect(lastDigit('ABC 123')).toBe(3) // 3-digit plates
    expect(lastDigit('abc1230')).toBe(0)
    expect(lastDigit('  nbc 1234  ')).toBe(4)
  })
  it('has no digit for empty or letter-only plates', () => {
    for (const p of ['', '   ', 'NBC', '---']) expect(lastDigit(p), p).toBeNull()
    expect(lastDigit(undefined as unknown as string)).toBeNull()
  })
  it('second-to-last digit needs at least two digits', () => {
    expect(secondLastDigit('NBC 1234')).toBe(3)
    expect(secondLastDigit('ABC 5')).toBeNull()
    expect(secondLastDigit('')).toBeNull()
  })
})

describe('coding day from the plate (MMDA scheme)', () => {
  const day = (plate: string) => codingDayFor('car', plate)
  it('maps each last digit to its day', () => {
    expect(['NBC 0001', 'NBC 0002'].map(day)).toEqual(['Monday', 'Monday'])
    expect(['NBC 0003', 'NBC 0004'].map(day)).toEqual(['Tuesday', 'Tuesday'])
    expect(['NBC 0005', 'NBC 0006'].map(day)).toEqual(['Wednesday', 'Wednesday'])
    expect(['NBC 0007', 'NBC 0008'].map(day)).toEqual(['Thursday', 'Thursday'])
    expect(['NBC 0009', 'NBC 0010'].map(day)).toEqual(['Friday', 'Friday']) // 9 and 0
  })
  it('the Hilux seed plate is consistent with its Wednesday coding day', () => {
    expect(day('NBC 1235')).toBe('Wednesday')
    expect(day('NBC 1234')).toBe('Tuesday')
  })
  it('every digit 0-9 yields a weekday, never undefined', () => {
    for (let d = 0; d <= 9; d++) expect(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']).toContain(day(`ABC 123${d}`))
  })
  it('motorcycles are never coded, whatever the plate', () => {
    for (const p of ['123 ABC', '1234 AB', 'ABC 1235', '']) expect(codingDayFor('motorcycle', p), p).toBe('Exempt')
  })
  it('a car with no plate digit yet stays exempt (nothing to apply)', () => {
    expect(day('')).toBe('Exempt')
    expect(day('NBC')).toBe('Exempt')
  })
  it('codingIsAuto tells a derived day from a manual override', () => {
    expect(codingIsAuto({ type: 'car', plate: 'NBC 1234', codingDay: 'Tuesday' })).toBe(true)
    expect(codingIsAuto({ type: 'car', plate: 'NBC 1234', codingDay: 'Wednesday' })).toBe(false)
    expect(codingIsAuto({ type: 'motorcycle', plate: '123 ABC', codingDay: 'Exempt' })).toBe(true)
  })
})

describe('nextRenewal', () => {
  it('uses the last day of the renewal month', () => {
    const r = nextRenewal('NBC 1234', 'car', '2026-01-10')! // digit 4 -> April (table value)
    expect(r.month).toBe(4)
    expect(r.deadline).toBe('2026-04-30')
    expect(r.daysLeft).toBe(110) // Jan 10 -> Apr 30
  })
  it('handles month lengths and leap years', () => {
    expect(nextRenewal('X 2', 'car', '2024-01-01')!.deadline).toBe('2024-02-29') // leap year
    expect(nextRenewal('X 2', 'car', '2026-01-01')!.deadline).toBe('2026-02-28')
    expect(nextRenewal('X 9', 'car', '2026-01-01')!.deadline).toBe('2026-09-30')
  })
  it('digit 0 renews in October', () => {
    expect(nextRenewal('X 10', 'car', '2026-01-01')!.deadline).toBe('2026-10-31')
  })
  it('status moves ok -> soon -> due -> overdue as the deadline nears and passes', () => {
    const at = (today: string) => nextRenewal('X 4', 'car', today)! // deadline 2026-04-30
    expect(at('2026-02-01').status).toBe('ok')
    expect(at('2026-04-10').status).toBe('soon') // 20 days
    expect(at('2026-04-25').status).toBe('due') // 5 days
    expect(at('2026-04-30')).toMatchObject({ status: 'due', daysLeft: 0 }) // the last day is not yet overdue
    expect(at('2026-05-05')).toMatchObject({ status: 'overdue', daysLeft: -5, deadline: '2026-04-30' })
  })
  it('a long-passed deadline rolls to next year instead of staying overdue forever', () => {
    const r = nextRenewal('X 4', 'car', '2026-08-15')!
    expect(r.deadline).toBe('2027-04-30')
    expect(r.status).toBe('ok')
  })
  it('works across the new year', () => {
    const r = nextRenewal('X 1', 'car', '2026-12-20')! // January, already past -> next year
    expect(r.deadline).toBe('2027-01-31')
    expect(r.daysLeft).toBe(42)
  })
  it('returns null when there is nothing to compute from', () => {
    expect(nextRenewal('', 'car', '2026-01-01')).toBeNull()
    expect(nextRenewal('NBC', 'car', '2026-01-01')).toBeNull()
    expect(nextRenewal('NBC 1234', 'car', 'garbage')).toBeNull()
  })
})

describe('seed data agrees with the plate rules', () => {
  it('both demo vehicles have a coding day that matches their plate', async () => {
    const { buildDemoState } = await import('./data')
    for (const v of buildDemoState('2026-06-01').vehicles) expect(codingIsAuto(v), `${v.nickname}: ${v.plate} / ${v.codingDay}`).toBe(true)
  })
})
