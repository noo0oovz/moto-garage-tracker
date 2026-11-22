import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import {
  areaCoords, brandRows, estimateAt, freshness, haversineKm, nearestAreas, parseFuelData, typicalPrice,
  type FwArea, type FwData,
} from './pricing'
import { parseWeek } from '../scripts/week.mjs'

const area = (name: string, province: string, ron95: Record<string, [number, number]>): FwArea => ({ name, province, prices: { 'RON 95': ron95 } })
const data = (areas: FwArea[]): FwData => ({
  schema: 1, generatedAt: '', source: '',
  regions: [{ id: 'r', label: 'R', weekStart: '2026-11-10', weekEnd: '2026-11-16', sources: [], areas }],
})

describe('typicalPrice / brandRows', () => {
  const a = area('Manila City', '', { PETRON: [70, 72], SHELL: [78, 80], CALTEX: [74, 76] })
  it('uses the median of brand midpoints, so one outlier cannot skew it', () => {
    expect(typicalPrice(a, 'RON 95')).toBe(75) // mids 71, 75, 79 -> 75
    const odd = area('X', '', { A: [70, 70], B: [71, 71], C: [140, 140] })
    expect(typicalPrice(odd, 'RON 95')).toBe(71)
  })
  it('averages the two middle brands for an even count', () => {
    expect(typicalPrice(area('X', '', { A: [70, 70], B: [80, 80] }), 'RON 95')).toBe(75)
  })
  it('returns null when a product has no data', () => {
    expect(typicalPrice(a, 'DIESEL')).toBeNull()
  })
  it('sorts brands cheapest first', () => {
    expect(brandRows(a, 'RON 95').map((r) => r.brand)).toEqual(['PETRON', 'CALTEX', 'SHELL'])
  })
})

describe('geography', () => {
  it('haversine: Manila to Davao is roughly 970 km', () => {
    const d = haversineKm([14.6, 120.98], [7.07, 125.61])
    expect(d).toBeGreaterThan(900)
    expect(d).toBeLessThan(1050)
  })
  it('haversine of identical points is 0', () => {
    expect(haversineKm([14.6, 120.98], [14.6, 120.98])).toBeCloseTo(0)
  })
  it('places cities by name, ignoring accents and the word "City"', () => {
    expect(areaCoords(area('Parañaque City', '', {}))).toEqual(areaCoords(area('Paranaque', '', {})))
    expect(areaCoords(area('Parañaque City', '', {}))).not.toBeNull()
  })
  it('falls back to the province, then to a province-only entry, then null', () => {
    expect(areaCoords(area('Unknown Town', 'Laguna', {}))).toEqual(areaCoords(area('Laguna', '', {})))
    expect(areaCoords(area('Nowhere', 'Atlantis', {}))).toBeNull()
  })
})

describe('nearestAreas / estimateAt', () => {
  const d = data([
    area('Manila City', '', { PETRON: [70, 70], SHELL: [80, 80] }), // median 75
    area('Pasay City', '', { PETRON: [72, 72], SHELL: [82, 82] }), // median 77
    area('Davao City', 'Davao del Sur', { PETRON: [68, 68] }),
    area('Nowhere', 'Atlantis', { PETRON: [1, 1] }), // unplaceable: must never be returned
  ])
  it('ranks by distance and skips areas it cannot place', () => {
    const n = nearestAreas(d, [14.5831, 120.9794], 10)
    expect(n[0].place.area.name).toBe('Manila City')
    expect(n.map((x) => x.place.area.name)).not.toContain('Nowhere')
  })
  it('blends nearby areas toward the closer one', () => {
    const e = estimateAt(d, [14.6, 120.98], 'RON 95')!
    expect(e.price).toBeGreaterThan(75)
    expect(e.price).toBeLessThan(77) // between the two, but pulled toward Manila
    expect(e.price).toBeLessThan(76)
    expect(e.used.length).toBe(2) // Davao is far beyond range
  })
  it('refuses to estimate when nothing is within range', () => {
    expect(estimateAt(d, [10.31, 123.89], 'RON 95')).toBeNull() // Cebu: > 60 km from every area
  })
  it('skips nearby areas that have no price for the product', () => {
    expect(estimateAt(d, [14.6, 120.98], 'DIESEL')).toBeNull()
  })
})

describe('freshness', () => {
  const at = (iso: string) => new Date(iso + 'T12:00:00')
  it('classifies by days since the week ended', () => {
    expect(freshness('2026-11-16', at('2026-11-20'))).toBe('current')
    expect(freshness('2026-11-16', at('2026-11-30'))).toBe('aging')
    expect(freshness('2026-11-16', at('2026-12-10'))).toBe('stale')
  })
})

describe('parseFuelData', () => {
  it('rejects wrong schema or shape', () => {
    expect(parseFuelData(null)).toBeNull()
    expect(parseFuelData({ schema: 2, regions: [] })).toBeNull()
    expect(parseFuelData({ schema: 1 })).toBeNull()
  })
  it('drops malformed regions but keeps good ones', () => {
    const d = parseFuelData({ schema: 1, regions: [{ id: 'a', areas: [] }, { nope: true }, null] })
    expect(d?.regions.map((r) => r.id)).toEqual(['a'])
  })
})

describe('parseWeek (importer)', () => {
  it('reads the formats DOE actually uses', () => {
    expect(parseWeek('November 10-16, 2026')).toEqual({ start: '2026-11-10', end: '2026-11-16' })
    expect(parseWeek('OCTOBER 27-NOVEMBER 02, 2026')).toEqual({ start: '2026-10-27', end: '2026-11-02' })
    expect(parseWeek('Nov 3 - Nov 9 2026')).toEqual({ start: '2026-11-03', end: '2026-11-09' })
  })
  it('rolls the year over for a week that spans New Year', () => {
    expect(parseWeek('December 29-January 4, 2026')).toEqual({ start: '2026-12-29', end: '2027-01-04' })
  })
  it('returns null for text it cannot read', () => {
    expect(parseWeek('')).toBeNull()
    expect(parseWeek('no dates here')).toBeNull()
  })
})

// Guards the file the app actually ships: catches a bad weekly import before it reaches users.
describe('shipped public/fuel-prices.json', () => {
  const file = 'public/fuel-prices.json'
  const d = fs.existsSync(file) ? parseFuelData(JSON.parse(fs.readFileSync(file, 'utf8'))) : null
  it('is present and valid', () => { expect(d).not.toBeNull() })
  it('has a sane price in every cell', () => {
    const bad: string[] = []
    for (const r of d?.regions ?? []) for (const a of r.areas) for (const [p, brands] of Object.entries(a.prices)) for (const [b, [lo, hi]] of Object.entries(brands ?? {})) {
      if (!(lo > 30 && hi < 200 && lo <= hi)) bad.push(`${r.id} ${a.name} ${p} ${b} ${lo}-${hi}`)
    }
    expect(bad).toEqual([])
  })
  it('labels no area with boilerplate', () => {
    const labels = (d?.regions ?? []).flatMap((r) => r.areas.map((a) => `${a.province} ${a.name}`))
    expect(labels.filter((l) => /date|monitor|note|\d/i.test(l))).toEqual([])
  })
  it('places every area so "nearest" can reach it', () => {
    const unplaced = (d?.regions ?? []).flatMap((r) => r.areas).filter((a) => !areaCoords(a)).map((a) => a.name)
    expect(unplaced).toEqual([])
  })
})
