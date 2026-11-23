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
  const call = src.slice(src.indexOf('saveVehicle({'), src.indexOf("openModal({ kind: 'setup'", src.indexOf('saveVehicle({')))
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

import { DEFAULT_VIEW, ZOOM_MAX, ZOOM_MIN, cleanView, dragView, frameLayout, nudgeView, panRange } from './photo'

describe('cleaning a photo framing', () => {
  it('keeps a valid framing', () => {
    expect(cleanView({ x: 20, y: 80, zoom: 2 })).toEqual({ x: 20, y: 80, zoom: 2 })
  })
  it('treats the default framing as no framing', () => {
    expect(cleanView({ x: 50, y: 50, zoom: 1 })).toBeUndefined()
    expect(cleanView({})).toBeUndefined()
    expect(cleanView(undefined)).toBeUndefined()
  })
  it('pulls out-of-range numbers back into range', () => {
    expect(cleanView({ x: -40, y: 900, zoom: 99 })).toEqual({ x: 0, y: 100, zoom: ZOOM_MAX })
    expect(cleanView({ x: 10, y: 10, zoom: 0.2 })).toEqual({ x: 10, y: 10, zoom: ZOOM_MIN })
  })
  it('replaces unusable parts with the centre / no zoom, and never throws', () => {
    for (const bad of [null, 5, 'x', [], [1, 2], true, { x: 'a', y: null, zoom: {} }, { x: NaN, y: Infinity, zoom: -Infinity }]) {
      expect(() => cleanView(bad), JSON.stringify(bad)).not.toThrow()
      const r = cleanView(bad)
      if (r) for (const n of [r.x, r.y, r.zoom]) expect(Number.isFinite(n)).toBe(true)
    }
    expect(cleanView({ x: 'a', y: 20, zoom: 2 })).toEqual({ x: 50, y: 20, zoom: 2 })
  })
  it('ignores extra properties, so nothing unexpected is stored', () => {
    const r = cleanView({ x: 10, y: 10, zoom: 2, evil: '<script>', __proto__: { polluted: true } })
    expect(Object.keys(r!).sort()).toEqual(['x', 'y', 'zoom'])
  })
})

describe('laying out a framed photo', () => {
  it('centred and unzoomed fills the frame exactly', () => {
    expect(frameLayout(undefined).inner).toEqual({ width: '100%', height: '100%', left: '0%', top: '0%' })
    expect(frameLayout({ x: 50, y: 50, zoom: 1 }).objectPosition).toBe('50% 50%')
  })
  it('zooming makes the picture box bigger and slides it by the chosen position', () => {
    expect(frameLayout({ x: 0, y: 0, zoom: 2 }).inner).toEqual({ width: '200%', height: '200%', left: '0%', top: '0%' })
    expect(frameLayout({ x: 100, y: 100, zoom: 2 }).inner).toEqual({ width: '200%', height: '200%', left: '-100%', top: '-100%' })
    expect(frameLayout({ x: 50, y: 50, zoom: 3 }).inner.left).toBe('-100%')
  })
  it('the picture box always covers the frame, so no view can show empty space', () => {
    for (const zoom of [1, 1.25, 2, 3]) for (const x of [0, 33, 50, 100]) for (const y of [0, 66, 100]) {
      const { inner } = frameLayout({ x, y, zoom })
      const w = parseFloat(inner.width), l = parseFloat(inner.left), t = parseFloat(inner.top), h = parseFloat(inner.height)
      expect(l).toBeLessThanOrEqual(0.0001); expect(l + w).toBeGreaterThanOrEqual(99.99)
      expect(t).toBeLessThanOrEqual(0.0001); expect(t + h).toBeGreaterThanOrEqual(99.99)
    }
  })
  it('a damaged framing falls back to centred', () => {
    expect(frameLayout({ x: NaN, y: NaN, zoom: NaN } as never).inner.width).toBe('100%')
  })
})

describe('dragging a photo', () => {
  const range = { x: 200, y: 100 }
  it('dragging the picture right shows more of its left side (x goes down)', () => {
    expect(dragView({ x: 50, y: 50, zoom: 2 }, 100, 0, range).x).toBe(0)
    expect(dragView({ x: 50, y: 50, zoom: 2 }, -100, 0, range).x).toBe(100)
  })
  it('a drag of half the travel moves the view by half the scale', () => {
    expect(dragView({ x: 50, y: 50, zoom: 2 }, 0, -25, range).y).toBe(75)
  })
  it('never leaves 0-100, however far it is dragged', () => {
    const v = dragView({ x: 50, y: 50, zoom: 2 }, 99999, -99999, range)
    expect(v.x).toBe(0); expect(v.y).toBe(100)
  })
  it('an axis with no travel cannot move', () => {
    expect(dragView({ x: 50, y: 50, zoom: 1 }, 300, 300, { x: 0, y: 0 })).toEqual({ x: 50, y: 50, zoom: 1 })
  })
  it('keeps the zoom, and survives nonsense input', () => {
    expect(dragView({ x: 20, y: 20, zoom: 2.5 }, 10, 10, range).zoom).toBe(2.5)
    expect(() => dragView({ x: 50, y: 50, zoom: 2 }, NaN, Infinity, range)).not.toThrow()
    expect(dragView({ x: 50, y: 50, zoom: 2 }, NaN, NaN, range)).toEqual({ x: 50, y: 50, zoom: 2 })
  })
})

describe('how far a photo can move', () => {
  it('a 4:3 photo in a 16:10 frame can only slide up and down, until zoomed', () => {
    const r = panRange(320, 200, 960, 720, 1)
    expect(r.x).toBe(0); expect(r.y).toBeCloseTo(40)
  })
  it('zooming adds travel in both directions', () => {
    const r1 = panRange(320, 200, 960, 720, 1), r2 = panRange(320, 200, 960, 720, 2)
    expect(r2.x).toBeGreaterThan(r1.x); expect(r2.y).toBeGreaterThan(r1.y)
  })
  it('a photo already the frame shape has nothing to move at zoom 1', () => {
    expect(panRange(320, 200, 1600, 1000, 1)).toEqual({ x: 0, y: 0 })
  })
  it('is zero, never NaN, for a frame or picture that has no size yet', () => {
    for (const a of [[0, 0, 0, 0], [320, 200, 0, 0], [NaN, 200, 10, 10], [320, 200, -1, 5]] as const) expect(panRange(a[0], a[1], a[2], a[3], 2)).toEqual({ x: 0, y: 0 })
  })
})

describe('nudging with the keyboard', () => {
  it('moves by the step and stops at the edges', () => {
    expect(nudgeView({ x: 50, y: 50, zoom: 2 }, 3, -3)).toEqual({ x: 53, y: 47, zoom: 2 })
    expect(nudgeView({ x: 99, y: 1, zoom: 2 }, 10, -10)).toEqual({ x: 100, y: 0, zoom: 2 })
  })
})

describe('framing is kept with the photo', () => {
  const src = fs.readFileSync('src/modals.tsx', 'utf8')
  const call = src.slice(src.indexOf('saveVehicle({'), src.indexOf("openModal({ kind: 'setup'", src.indexOf('saveVehicle({')))
  it('the form saves the framing, and only when there is a photo', () => {
    expect(call).toMatch(/photoView: photo \? photoView : undefined/)
  })
  it('a backup keeps a valid framing and drops a damaged or orphaned one', () => {
    const base = () => JSON.parse(JSON.stringify(buildDemoState('2026-06-01')))
    const ok = base(); ok.vehicles[0].photo = jpeg(300); ok.vehicles[0].photoView = { x: 10, y: 90, zoom: 2 }
    expect(migrate(ok)!.vehicles[0].photoView).toEqual({ x: 10, y: 90, zoom: 2 })
    const wild = base(); wild.vehicles[0].photo = jpeg(300); wild.vehicles[0].photoView = { x: 9e9, y: -9e9, zoom: 'big', evil: 1 }
    expect(migrate(wild)!.vehicles[0].photoView).toEqual({ x: 100, y: 0, zoom: 1 })
    const orphan = base(); orphan.vehicles[0].photoView = { x: 10, y: 90, zoom: 2 }
    expect(migrate(orphan)!.vehicles[0].photoView).toBeUndefined()
    const dropped = base(); dropped.vehicles[0].photo = 'javascript:alert(1)'; dropped.vehicles[0].photoView = { x: 10, y: 90, zoom: 2 }
    expect(migrate(dropped)!.vehicles[0].photoView).toBeUndefined()
  })
  it('the Garage header, the Vehicles page and the editor all draw through the same component', () => {
    for (const f of ['VehicleHero', 'pages', 'PhotoFramer']) expect(fs.readFileSync(`src/${f}.tsx`, 'utf8'), f).toMatch(/FramedPhoto/)
  })
})
void DEFAULT_VIEW

describe('a photo that already fits the frame', () => {
  it('offers no movement, even when whole-pixel frame sizes make it a pixel or two off', () => {
    // 960x600 is exactly 16:10; a 470x294 frame is 1.5986, a hair narrower
    expect(panRange(470, 294, 960, 600, 1)).toEqual({ x: 0, y: 0 })
    expect(panRange(471, 294, 960, 600, 1)).toEqual({ x: 0, y: 0 })
    expect(panRange(320, 199, 1600, 1000, 1)).toEqual({ x: 0, y: 0 })
  })
  it('still offers real movement', () => {
    expect(panRange(470, 294, 960, 720, 1).y).toBeGreaterThan(20)
    expect(panRange(470, 294, 960, 600, 2).x).toBeGreaterThan(400)
  })
})
