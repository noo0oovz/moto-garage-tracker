import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { DARK, LIGHT, THEME_CHOICES, contrast, pairings, resolveTheme, themeColor, type Palette } from './theme'

describe('contrast helper', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    expect(contrast('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1) // the well-known "just passes AA" grey
  })
  it('is symmetric', () => {
    expect(contrast('#0A6E8A', '#FFFFFF')).toBeCloseTo(contrast('#FFFFFF', '#0A6E8A'), 10)
  })
})

describe.each([['light', LIGHT], ['dark', DARK]] as [string, Palette][])('%s palette is accessible', (_name, p) => {
  for (const pair of pairings(p)) {
    it(`${pair.name} reaches ${pair.min}:1`, () => {
      expect(contrast(pair.fg, pair.bg), `${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(pair.min)
    })
  }
})

describe('palette design rules', () => {
  it('dark mode separates tiers by lightness, in the right order (canvas darkest, then surface, then raised)', () => {
    const l = (h: string) => contrast(h, '#000000')
    expect(l(DARK.canvas)).toBeLessThan(l(DARK.surface)); expect(l(DARK.surface)).toBeLessThan(l(DARK.surface2))
  })
  it('light mode cards are brighter than the canvas behind them', () => {
    expect(contrast(LIGHT.surface, '#000000')).toBeGreaterThan(contrast(LIGHT.canvas, '#000000'))
  })
  it('the brand hue is distinct from every status hue (so a status colour always means status)', () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
      if (d === 0) return 0
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return (h * 60 + 360) % 360
    }
    const diff = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
    for (const p of [LIGHT, DARK]) {
      for (const status of [p.ok, p.soon, p.over]) expect(diff(hue(p.brand), hue(status)), `${p.brand} vs ${status}`).toBeGreaterThan(40)
    }
  })
  it('status colours are three different hues', () => {
    for (const p of [LIGHT, DARK]) {
      const set = new Set([p.ok, p.soon, p.over]); expect(set.size).toBe(3)
    }
  })
})

describe('theme mode', () => {
  it('offers automatic, light and dark, with automatic first (the default)', () => {
    expect(THEME_CHOICES).toEqual(['system', 'light', 'dark'])
  })
  it('automatic follows the device; an explicit choice ignores it', () => {
    expect(resolveTheme('system', true)).toBe('dark'); expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light'); expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('the browser bar matches the page canvas in each mode', () => {
    expect(themeColor('light')).toBe(LIGHT.canvas); expect(themeColor('dark')).toBe(DARK.canvas)
  })
})

describe('the CSS and the token file agree (no drift)', () => {
  const css = fs.readFileSync('src/index.css', 'utf8').toLowerCase()
  const has = (hex: string) => css.includes(hex.toLowerCase())
  it('every solid colour in the token file is present in index.css', () => {
    for (const [mode, p] of [['light', LIGHT], ['dark', DARK]] as const) {
      for (const [k, v] of Object.entries(p)) {
        if (v.startsWith('#')) expect(has(v), `${mode}.${k} ${v} missing from index.css`).toBe(true)
      }
    }
  })
  it('index.html sets the theme before first paint (no light/dark flash)', () => {
    const html = fs.readFileSync('index.html', 'utf8')
    expect(html).toMatch(/<script>[\s\S]*prefers-color-scheme[\s\S]*<\/script>/)
  })
  it('no leftover hardcoded legacy colours in the app source', () => {
    const legacy = ['#0b0f17', '#131a26', '#0f1520', '#f97316', '#f4f6fa']
    for (const f of fs.readdirSync('src').filter((n) => n.endsWith('.tsx') || n.endsWith('.ts'))) {
      if (f.endsWith('.test.ts') || f === 'theme.ts') continue
      const src = fs.readFileSync(`src/${f}`, 'utf8').toLowerCase()
      for (const c of legacy) expect(src.includes(c), `${f} still uses ${c}`).toBe(false)
    }
  })
  it('respects reduced motion', () => {
    expect(css).toContain('prefers-reduced-motion')
  })
})
