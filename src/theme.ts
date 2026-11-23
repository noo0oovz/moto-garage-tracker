// Design tokens: the single source of truth for the app's colours.
//
// The values below are written into src/index.css (see the comment there) and are read by theme.test.ts, which asserts
// WCAG contrast for every text/background pair in BOTH modes. If you change a colour here, change it in index.css too;
// the test fails if the two files drift apart.

export interface Palette {
  canvas: string       // page background
  surface: string      // cards
  surface2: string     // raised / inputs / selected rows
  hairline: string     // 1px borders (rgba)
  text: string
  text2: string        // secondary
  text3: string        // tertiary / meta (large or non-essential text only)
  brand: string        // brand text / links / fills
  brandOn: string      // text drawn ON a brand fill
  brandBg: string      // tinted brand background
  ok: string; okBg: string
  soon: string; soonBg: string
  over: string; overBg: string
}

export const LIGHT: Palette = {
  canvas: '#F2F2F7', surface: '#FFFFFF', surface2: '#F7F7FA', hairline: 'rgba(60,60,67,0.14)',
  text: '#1C1C1E', text2: '#6C6C70', text3: '#8E8E93',
  brand: '#0A6E8A', brandOn: '#FFFFFF', brandBg: '#E3F1F5',
  ok: '#1E7A3C', okBg: '#E6F4EA',
  soon: '#8A5A00', soonBg: '#FFF4DC',
  over: '#B3261E', overBg: '#FDE7E4',
}

export const DARK: Palette = {
  canvas: '#000000', surface: '#1C1C1E', surface2: '#2C2C2E', hairline: 'rgba(255,255,255,0.10)',
  text: '#F5F5F7', text2: '#A1A1A6', text3: '#8E8E93',
  brand: '#4FC3E0', brandOn: '#00222B', brandBg: '#0E2A33',
  ok: '#5FD08A', okBg: '#16301F',
  soon: '#FFB84D', soonBg: '#33260A',
  over: '#FF8A80', overBg: '#3A1714',
}

export type ThemeChoice = 'system' | 'light' | 'dark'
export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark']

/** What the page actually shows, given the user's choice and the device setting. */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): 'light' | 'dark' {
  return choice === 'system' ? (systemPrefersDark ? 'dark' : 'light') : choice
}

/** Colour of the browser / status bar for a resolved theme. */
export const themeColor = (resolved: 'light' | 'dark') => (resolved === 'dark' ? DARK.canvas : LIGHT.canvas)

// ---- WCAG contrast ----------------------------------------------------------------------------------------------
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** WCAG 2.x contrast ratio between two opaque #RRGGBB colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Every pairing the UI draws, with the minimum ratio it must meet (4.5 body text, 3 for large/meta/non-text). */
export function pairings(p: Palette): { name: string; fg: string; bg: string; min: number }[] {
  return [
    { name: 'text on surface', fg: p.text, bg: p.surface, min: 4.5 },
    { name: 'text on canvas', fg: p.text, bg: p.canvas, min: 4.5 },
    { name: 'text on surface-2', fg: p.text, bg: p.surface2, min: 4.5 },
    { name: 'secondary on surface', fg: p.text2, bg: p.surface, min: 4.5 },
    { name: 'secondary on surface-2', fg: p.text2, bg: p.surface2, min: 4.5 },
    { name: 'secondary on canvas', fg: p.text2, bg: p.canvas, min: 4.5 },
    { name: 'tertiary on surface (meta only)', fg: p.text3, bg: p.surface, min: 3 },
    { name: 'brand text on surface', fg: p.brand, bg: p.surface, min: 4.5 },
    { name: 'brand text on canvas', fg: p.brand, bg: p.canvas, min: 4.5 },
    { name: 'brand text on its tint', fg: p.brand, bg: p.brandBg, min: 4.5 },
    { name: 'text on brand fill (button)', fg: p.brandOn, bg: p.brand, min: 4.5 },
    { name: 'healthy on surface', fg: p.ok, bg: p.surface, min: 4.5 },
    { name: 'healthy on its pill', fg: p.ok, bg: p.okBg, min: 4.5 },
    { name: 'due soon on surface', fg: p.soon, bg: p.surface, min: 4.5 },
    { name: 'due soon on its pill', fg: p.soon, bg: p.soonBg, min: 4.5 },
    { name: 'overdue on surface', fg: p.over, bg: p.surface, min: 4.5 },
    { name: 'overdue on its pill', fg: p.over, bg: p.overBg, min: 4.5 },
  ]
}
