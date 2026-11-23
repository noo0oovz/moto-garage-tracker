import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { PHOTO_MAX_CHARS, PHOTO_MAX_SIDE, fitWithin, isPhoto, storageHeadroom } from './photo'
import { migrate } from './migrate'
import { buildDemoState } from './data'

const jpeg = (n: number) => 'data:image/jpeg;base64,' + 'A'.repeat(n)

describe('what counts as a stored photo', () => {
  it('accepts a JPEG, PNG or WebP data URL of sensible size', () => {
    expect(isPhoto(jpeg(100))).toBe(true)
    expect(isPhoto('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isPhoto('data:image/webp;base64,UklGRg==')).toBe(true)
  })
  it('refuses anything that could run code, load from the internet, or fill the storage', () => {
    for (const bad of [
      'javascript:alert(1)', 'https://evil.example/x.png', 'http://x/y.jpg', '//evil.example/x.png', 'file:///c:/secret.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:text/html;base64,PGgxPng8L2gxPg==', 'data:application/javascript;base64,YWxlcnQoMSk=',
      'data:image/jpeg;base64,@@@@', 'data:image/jpeg;base64,', 'data:image/jpeg,raw', 'data:image/gif;base64,R0lGOD',
      jpeg(PHOTO_MAX_CHARS), '', ' ', 'data:image/jpeg;base64,AAAA\n<script>', 'data:image/jpeg;base64,AAAA"onerror="x',
    ]) expect(isPhoto(bad), bad.slice(0, 40)).toBe(false)
  })
  it('refuses things that are not strings, and never throws', () => {
    for (const bad of [undefined, null, 0, 5, {}, [], ['data:image/jpeg;base64,AA'], true, Symbol.iterator as unknown]) expect(isPhoto(bad)).toBe(false)
  })
  it('the size limit is exact', () => {
    const prefix = 'data:image/jpeg;base64,'
    expect(isPhoto(prefix + 'A'.repeat(PHOTO_MAX_CHARS - prefix.length))).toBe(true)
    expect(isPhoto(prefix + 'A'.repeat(PHOTO_MAX_CHARS - prefix.length + 1))).toBe(false)
  })
})

describe('shrinking a picture', () => {
  it('fits the long side to the limit and keeps the proportions', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 960, height: 720 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 720, height: 960 })
    expect(fitWithin(9000, 7000, 960).width).toBe(960)
  })
  it('never enlarges a small picture', () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 })
    expect(fitWithin(960, 960)).toEqual({ width: 960, height: 960 })
  })
  it('never returns a zero or non-numeric size, whatever it is given', () => {
    for (const [w, h] of [[0, 0], [-5, 10], [NaN, 5], [5, Infinity], [1, 100000], [100000, 1]] as const) {
      const r = fitWithin(w, h)
      expect(r.width).toBeGreaterThanOrEqual(1)
      expect(r.height).toBeGreaterThanOrEqual(1)
      expect(Number.isFinite(r.width) && Number.isFinite(r.height)).toBe(true)
      expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(Math.max(PHOTO_MAX_SIDE, 1))
    }
  })
})

describe('storage headroom', () => {
  it('is what is left of the limit, and never negative', () => {
    expect(storageHeadroom('x'.repeat(1000), 5000)).toBe(4000)
    expect(storageHeadroom('x'.repeat(9000), 5000)).toBe(0)
    expect(storageHeadroom('', 5000)).toBe(5000)
  })
})

describe('photos in a backup file', () => {
  const withPhoto = (photo: unknown) => { const s = JSON.parse(JSON.stringify(buildDemoState('2026-06-01'))); s.vehicles[0].photo = photo; return migrate(s)! }
  it('a valid photo survives the round trip', () => {
    expect(withPhoto(jpeg(500)).vehicles[0].photo).toBe(jpeg(500))
  })
  it('an unsafe or oversized photo is dropped, and the rest of the vehicle is kept', () => {
    for (const bad of ['javascript:alert(1)', 'https://evil.example/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', jpeg(PHOTO_MAX_CHARS), { a: 1 }, 7]) {
      const v = withPhoto(bad).vehicles[0]
      expect(v.photo).toBeUndefined()
      expect(v.nickname.length).toBeGreaterThan(0)
    }
  })
})

describe('editing a vehicle keeps what the form does not show', () => {
  const src = fs.readFileSync('src/modals.tsx', 'utf8')
  const call = src.slice(src.indexOf('saveVehicle({'), src.indexOf('saveVehicle({') + 900)
  it('starts from the saved vehicle, so bike type, engine size, gearbox and driving answers are not erased', () => {
    expect(call).toMatch(/\.\.\.\(item \?\? \{\}\)/)
  })
  it('passes the photo through', () => {
    expect(call).toMatch(/\bphoto\b/)
  })
  it('does not keep a bike type on a car', () => {
    expect(call).toMatch(/type === 'car'[^)]*bikeType: undefined/)
  })
})

describe('the Garage shows a photo instead of the drawing', () => {
  it('both the hero and the Vehicles cards use the photo when there is one', () => {
    expect(fs.readFileSync('src/VehicleHero.tsx', 'utf8')).toMatch(/v\.photo/)
    expect(fs.readFileSync('src/pages.tsx', 'utf8')).toMatch(/v\.photo/)
  })
})
