import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import {
  areaCoords, areaKey, brandRows, estimateAt, freshness, haversineKm, latestAdjustmentWeek, nearbyFallback, nearestAreas, parseFuelData, productGroup, projectPrice, searchAreas, typicalCurrent, typicalPrice,
  type FwArea, type FwData,
} from './pricing'
import { parseWeek } from '../scripts/week.mjs'

const area = (name: string, province: string, ron95: Record<string, [number, number]>): FwArea => ({ name, province, prices: { 'RON 95': ron95 } })
const data = (areas: FwArea[]): FwData => ({
  schema: 2, generatedAt: '', source: '', adjustments: [],
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
  it('keeps same-named places apart: Quezon City, Quezon province and Quezon in Bukidnon', () => {
    const qc = areaCoords(area('Quezon City', '', {}))!
    const prov = areaCoords(area('Quezon', '', {}))!
    const bukidnon = areaCoords(area('Quezon', 'Bukidnon', {}))!
    expect(haversineKm(qc, prov)).toBeGreaterThan(50) // province centre is far from Quezon City
    expect(haversineKm(bukidnon, qc)).toBeGreaterThan(500) // a town in Mindanao is nowhere near Metro Manila
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
    expect(parseFuelData({ schema: 3, regions: [] })).toBeNull() // unknown future schema
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
  it('puts well-known places under the right province (guards the importer label logic)', () => {
    const where = new Map<string, string>()
    for (const r of d?.regions ?? []) for (const a of r.areas) where.set(a.name, a.province)
    const expect_: [string, string][] = [
      ['Balilihan', 'Bohol'], ['Jagna', 'Bohol'], ['Borongan City', 'Eastern Samar'], ['Cadiz', 'Negros Occidental'],
      ['Kalibo', 'Aklan'], ['Boracay', 'Aklan'], ['Cebu City', 'Cebu'], ['Dumaguete City', 'Negros Oriental'],
      ['Davao City', 'Davao del Sur'], ['Tagum City', 'Davao del Norte'], ['Calamba', 'Laguna'], ['Bacoor', 'Cavite'],
    ]
    for (const [name, prov] of expect_) if (where.has(name)) expect({ name, province: where.get(name) }).toEqual({ name, province: prov })
  })
  it('has no truncated multi-line province names', () => {
    const bad = (d?.regions ?? []).flatMap((r) => r.areas).filter((a) => /^(oriental|occidental|norte|sur|del|de)$/i.test(a.province) || /(del|de)$/i.test(a.province))
    expect(bad.map((a) => `${a.province}/${a.name}`)).toEqual([])
  })
  it('has adjustments with sane values', () => {
    for (const a of d?.adjustments ?? []) for (const b of Object.values(a.brands)) for (const v of Object.values(b)) expect(Math.abs(v as number)).toBeLessThan(40)
  })
  it('places every area so "nearest" can reach it', () => {
    const unplaced = (d?.regions ?? []).flatMap((r) => r.areas).filter((a) => !areaCoords(a)).map((a) => a.name)
    expect(unplaced).toEqual([])
  })
})

describe('projectPrice (announced weekly adjustments)', () => {
  const adj = (weekStart: string, brands: FwData['adjustments'][number]['brands']) => ({ weekStart, weekEnd: weekStart, source: '', brands })
  const d = (adjustments: FwData['adjustments']): FwData => ({ ...data([]), adjustments })

  it('maps products to the right adjustment column', () => {
    expect(['RON 91', 'RON 95', 'RON 97', 'RON 100'].map((p) => productGroup(p as never))).toEqual(['gasoline', 'gasoline', 'gasoline', 'gasoline'])
    expect(productGroup('DIESEL')).toBe('diesel')
    expect(productGroup('DIESEL PLUS')).toBe('diesel')
    expect(productGroup('KEROSENE')).toBe('kerosene')
  })
  it('applies one announced change to a measured range', () => {
    const r = projectPrice(d([adj('2026-11-17', { PETRON: { gasoline: -1.5 } })]), '2026-11-10', 'PETRON', 'RON 95', [72, 74], '2026-11-20')!
    expect(r).toMatchObject({ lo: 70.5, hi: 72.5, delta: -1.5, weeks: ['2026-11-17'] })
  })
  it('chains several consecutive weeks', () => {
    const r = projectPrice(d([adj('2026-11-10', { SHELL: { diesel: -4.1 } }), adj('2026-11-17', { SHELL: { diesel: -3.8 } })]), '2026-11-03', 'SHELL', 'DIESEL', [95, 95], '2026-11-20')!
    expect(r.delta).toBeCloseTo(-7.9)
    expect(r.lo).toBeCloseTo(87.1)
  })
  it('returns null when a week in the chain is missing (never bridges a gap)', () => {
    expect(projectPrice(d([adj('2026-11-17', { SHELL: { diesel: -3.8 } })]), '2026-11-03', 'SHELL', 'DIESEL', [95, 95], '2026-11-20')).toBeNull()
  })
  it('returns null when the brand did not announce a change for that fuel', () => {
    expect(projectPrice(d([adj('2026-11-17', { PETRON: { gasoline: -1.5 } })]), '2026-11-10', 'PETRON', 'DIESEL', [90, 90], '2026-11-20')).toBeNull()
    expect(projectPrice(d([adj('2026-11-17', { PETRON: { gasoline: -1.5 } })]), '2026-11-10', 'SHELL', 'RON 95', [90, 90], '2026-11-20')).toBeNull()
  })
  it('does nothing when the measurement is already current', () => {
    expect(projectPrice(d([adj('2026-11-17', { PETRON: { gasoline: -1.5 } })]), '2026-11-17', 'PETRON', 'RON 95', [70, 70], '2026-11-20')).toBeNull()
  })
  it('ignores weeks that have not started yet', () => {
    expect(projectPrice(d([adj('2026-11-24', { PETRON: { gasoline: -1.5 } })]), '2026-11-17', 'PETRON', 'RON 95', [70, 70], '2026-11-20')).toBeNull()
  })
  it('finds the latest started adjustment week', () => {
    const x = d([adj('2026-11-24', {}), adj('2026-11-17', {}), adj('2026-11-10', {})])
    expect(latestAdjustmentWeek(x, '2026-11-20')?.weekStart).toBe('2026-11-17')
    expect(latestAdjustmentWeek(d([]), '2026-11-20')).toBeNull()
  })
})

describe('searchAreas', () => {
  const d: FwData = {
    ...data([]),
    regions: [
      { id: 'ncr', label: 'NCR', weekStart: '', weekEnd: '', sources: [], areas: [area('Parañaque City', '', {}), area('Pasay City', '', {}), area('Makati City', '', {})] },
      { id: 'mindanao', label: 'Mindanao', weekStart: '', weekEnd: '', sources: [], areas: [
        area('Davao City', 'Davao del Sur', {}), area('Digos City', 'Davao del Sur', {}), area('Tagum City', 'Davao del Norte', {}), area('Padada', 'Davao del Sur', {}),
      ] },
    ],
  }
  const names = (q: string) => searchAreas(d, q).map((h) => h.area.name)
  it('matches partial words, ignoring case and accents', () => {
    expect(names('para')).toEqual(['Parañaque City'])
    expect(names('PARANAQUE')).toEqual(['Parañaque City'])
    expect(names('pas')).toContain('Pasay City')
  })
  it('matches by province and region too', () => {
    expect(names('davao')).toEqual(expect.arrayContaining(['Davao City', 'Digos City', 'Tagum City', 'Padada']))
    expect(names('mindanao')).toHaveLength(4)
    expect(names('ncr')).toHaveLength(3)
  })
  it('requires every word to match (narrowing as you type)', () => {
    expect(names('davao sur').sort()).toEqual(['Davao City', 'Digos City', 'Padada'])
    expect(names('davao norte')).toEqual(['Tagum City'])
  })
  it('ranks exact and prefix matches above looser ones', () => {
    expect(names('davao city')[0]).toBe('Davao City')
    expect(searchAreas(d, 'davao')[0].area.name).toBe('Davao City') // name starts with "davao"
  })
  it('returns nothing for blank or unmatched queries', () => {
    expect(names('')).toEqual([])
    expect(names('   ')).toEqual([])
    expect(names('zzz')).toEqual([])
  })
  it('keys are stable and unique per area', () => {
    const keys = searchAreas(d, 'city').map((h) => h.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(areaKey(d.regions[0], d.regions[0].areas[0])).toBe('ncr||Parañaque City')
  })
})

describe('typicalCurrent', () => {
  const region = (areas: FwArea[]) => ({ id: 'r', label: 'R', weekStart: '2026-11-10', weekEnd: '2026-11-16', sources: [], areas })
  const a = area('Pasig City', '', { PETRON: [88, 90], SHELL: [90, 92], TOTAL: [85, 85] }) // mids 89, 91, 85
  const withAdj = (brands: FwData['adjustments'][number]['brands']): FwData => ({ ...data([a]), adjustments: [{ weekStart: '2026-11-17', weekEnd: '2026-11-23', source: '', brands }] })
  it('uses projected prices where the chain is complete, measured otherwise', () => {
    const d = withAdj({ PETRON: { gasoline: -4 }, SHELL: { gasoline: -4 } }) // TOTAL announced nothing
    const r = typicalCurrent(d, region([a]), a, 'RON 95', '2026-11-20')!
    // petron 85, shell 87, total 85 (measured) -> median 85
    expect(r.price).toBe(85)
    expect(r).toMatchObject({ projected: 2, measured: 1 })
  })
  it('equals the plain measured median when there are no adjustments', () => {
    const r = typicalCurrent(data([a]), region([a]), a, 'RON 95', '2026-11-20')!
    expect(r.price).toBe(typicalPrice(a, 'RON 95'))
    expect(r.projected).toBe(0)
  })
  it('is null for a product with no data', () => {
    expect(typicalCurrent(data([a]), region([a]), a, 'DIESEL', '2026-11-20')).toBeNull()
  })
})

describe('nearbyFallback (towns DOE does not monitor)', () => {
  const d: FwData = { ...data([]), regions: [{ id: 'ncr', label: 'NCR', weekStart: '', weekEnd: '', sources: [], areas: [area('Marikina City', '', {}), area('Quezon City', '', {})] }, { id: 'south-luzon', label: 'S', weekStart: '', weekEnd: '', sources: [], areas: [area('Antipolo', 'Rizal', {})] }] }
  it('offers the closest monitored areas for San Mateo, Rizal', () => {
    const f = nearbyFallback(d, 'san mateo rizal')!
    expect(f.town).toBe('San Mateo')
    expect(f.near[0].place.area.name).toBe('Marikina City') // ~6 km
    expect(f.near.every((n) => n.km <= 40)).toBe(true)
  })
  it('also works for just the town name, in any case', () => {
    expect(nearbyFallback(d, 'SAN MATEO')?.town).toBe('San Mateo')
    expect(nearbyFallback(d, 'cainta')?.town).toBe('Cainta')
  })
  it('returns null for unknown places and very short input', () => {
    expect(nearbyFallback(d, 'atlantis')).toBeNull()
    expect(nearbyFallback(d, 'sa')).toBeNull()
  })
})
