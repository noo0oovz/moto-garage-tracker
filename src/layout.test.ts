import { describe, expect, it } from 'vitest'
import { layoutFor } from './useLayout'

describe('layoutFor', () => {
  it('portrait phones get the phone layout', () => {
    expect(layoutFor(360, 640)).toBe('phone')
    expect(layoutFor(390, 844)).toBe('phone')
    expect(layoutFor(430, 932)).toBe('phone')
  })
  it('landscape phones get the compact layout, whatever their width', () => {
    expect(layoutFor(667, 375)).toBe('compact') // iPhone SE
    expect(layoutFor(844, 390)).toBe('compact') // iPhone 14
    expect(layoutFor(932, 430)).toBe('compact') // iPhone Pro Max
    expect(layoutFor(915, 412)).toBe('compact') // Pixel / Galaxy
  })
  it('tablets keep the rail layout in both orientations', () => {
    expect(layoutFor(768, 1024)).toBe('tablet')
    expect(layoutFor(820, 1180)).toBe('tablet')
    expect(layoutFor(1024 - 1, 768)).toBe('tablet') // iPad landscape in a narrow window
  })
  it('wide screens get the desktop sidebar, even when short', () => {
    expect(layoutFor(1024, 768)).toBe('desktop')
    expect(layoutFor(1180, 820)).toBe('desktop')
    expect(layoutFor(1440, 900)).toBe('desktop')
    expect(layoutFor(1366, 560)).toBe('desktop')
    expect(layoutFor(1280, 480)).toBe('desktop') // short browser window on a laptop
  })
  it('the boundary between compact and tablet is the 520px height', () => {
    expect(layoutFor(900, 520)).toBe('compact')
    expect(layoutFor(900, 521)).toBe('tablet')
  })
  it('a square-ish small window is a phone, not compact', () => {
    expect(layoutFor(500, 500)).toBe('phone') // not landscape
    expect(layoutFor(500, 480)).toBe('compact') // landscape and short
  })
})
