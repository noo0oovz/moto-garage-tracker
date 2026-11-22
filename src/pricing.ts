// Fuel Watch: types + pure logic for DOE pump-price data and "nearest area" estimates.
// Everything here runs in the browser; the user's location never leaves the device.

export const FW_PRODUCTS = ['RON 91', 'RON 95', 'RON 97', 'RON 100', 'DIESEL', 'DIESEL PLUS', 'KEROSENE'] as const
export type FwProduct = (typeof FW_PRODUCTS)[number]

export const FW_BRANDS = ['PETRON', 'SHELL', 'CALTEX', 'PHOENIX', 'TOTAL', 'FLYING V', 'UNIOIL', 'SEAOIL', 'PTT', 'JETTI', 'MY GAS', 'CLEAN FUEL', 'INDEPENDENT'] as const

export interface FwArea {
  name: string
  province: string
  prices: Partial<Record<FwProduct, Record<string, [number, number]>>>
}
export interface FwRegion {
  id: string
  label: string
  weekStart: string
  weekEnd: string
  sources: string[]
  areas: FwArea[]
}
export interface FwData {
  schema: number
  generatedAt: string
  source: string
  problems?: string[]
  regions: FwRegion[]
}

export interface Place {
  region: FwRegion
  area: FwArea
  label: string
}

// ---- Geography -------------------------------------------------------------------------------
// Approximate centres of the places DOE reports on. Province/city centroids only: this is for choosing
// the nearest *monitored area*, not for navigation, so ~10 km of error is irrelevant.
type LL = [number, number]
const PROVINCE: Record<string, LL> = {
  // NCR cities are handled in CITY below.
  Cavite: [14.28, 120.87], Laguna: [14.17, 121.33], Batangas: [13.78, 121.07], Rizal: [14.6, 121.3], Quezon: [14.0, 121.6],
  Albay: [13.18, 123.6], 'Camarines Sur': [13.6, 123.3], 'Camarines Norte': [14.15, 122.7], Masbate: [12.3, 123.6], Sorsogon: [12.9, 124.0],
  'Occidental Mindoro': [13.0, 120.9], 'Oriental Mindoro': [13.0, 121.3], Marinduque: [13.4, 122.0], Romblon: [12.5, 122.3], Palawan: [9.8, 118.7],
  'Zamboanga del Sur': [7.8, 123.3], 'Zamboanga del Norte': [8.15, 123.0], 'Zamboanga Sibugay': [7.7, 122.6], Basilan: [6.5, 122.0],
  'Misamis Oriental': [8.5, 124.6], 'Misamis Occidental': [8.4, 123.7], Bukidnon: [8.0, 125.1], 'Lanao del Norte': [8.0, 123.9], Camiguin: [9.2, 124.7],
  'Davao del Sur': [6.8, 125.3], 'Davao del Norte': [7.5, 125.8], 'Davao Oriental': [7.2, 126.4], 'Davao de Oro': [7.5, 126.1], 'Davao Occidental': [6.1, 125.6],
  'South Cotabato': [6.2, 124.8], Cotabato: [7.2, 124.9], 'Sultan Kudarat': [6.5, 124.4], Sarangani: [5.9, 125.2],
  'Agusan del Sur': [8.5, 126.0], 'Agusan del Norte': [9.0, 125.5], 'Surigao del Sur': [8.8, 126.1], 'Surigao del Norte': [9.6, 125.6], 'Dinagat Islands': [10.1, 125.6],
}
const CITY: Record<string, LL> = {
  'Caloocan City': [14.65, 120.97], 'Quezon City': [14.68, 121.04], 'Manila City': [14.6, 120.98], 'Pasig City': [14.58, 121.06],
  'Taguig City': [14.52, 121.05], 'Makati City': [14.55, 121.02], 'Parañaque City': [14.48, 121.02], 'Muntinlupa City': [14.38, 121.04],
  'Pasay City': [14.54, 121.0], 'Marikina City': [14.65, 121.1], 'Valenzuela City': [14.7, 120.98], 'Navotas City': [14.67, 120.94],
  Bacoor: [14.46, 120.96], 'Cavite City': [14.48, 120.9], Dasmariñas: [14.33, 120.94], 'General Trias': [14.39, 120.88], 'Imus City': [14.43, 120.94],
  'Tagaytay City': [14.11, 120.96], 'Trece Martires': [14.28, 120.87], Biñan: [14.34, 121.08], Cabuyao: [14.27, 121.12], Calamba: [14.21, 121.16],
  'San Pablo': [14.07, 121.33], 'San Pedro': [14.36, 121.05], 'Sta. Rosa': [14.31, 121.11], 'Batangas City': [13.76, 121.06], 'Lipa City': [13.94, 121.16],
  'Tanauan City': [14.09, 121.15], Antipolo: [14.59, 121.18], Lucena: [13.93, 121.62], Legaspi: [13.14, 123.74], 'Zamboanga City': [6.91, 122.07],
  'Pagadian City': [7.83, 123.44], 'Dapitan City': [8.65, 123.42], 'Dipolog City': [8.59, 123.34], 'Cagayan de Oro City': [8.48, 124.65], 'Davao City': [7.07, 125.61],
  'General Santos City': [6.11, 125.17], 'Butuan City': [8.95, 125.54], 'Surigao City': [9.78, 125.49], 'Cotabato City': [7.22, 124.25], 'Koronadal City': [6.5, 124.85],
  'Malaybalay City': [8.15, 125.13], 'Iligan City': [8.23, 124.24], 'Ozamiz City': [8.15, 123.84], 'Tagum City': [7.45, 125.81], 'Mati City': [6.95, 126.22],
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\bcity\b/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
}
const CITY_N = new Map(Object.entries(CITY).map(([k, v]) => [norm(k), v]))
const PROV_N = new Map(Object.entries(PROVINCE).map(([k, v]) => [norm(k), v]))

/** Best-known centre for an area: its own city, else its province (either as a field or as the name). */
export function areaCoords(a: FwArea): LL | null {
  return CITY_N.get(norm(a.name)) ?? PROV_N.get(norm(a.province)) ?? PROV_N.get(norm(a.name)) ?? null
}

export function haversineKm(a: LL, b: LL) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface Nearest { place: Place; km: number }

/** Closest monitored areas to a position. Areas we cannot place are never returned. */
export function nearestAreas(data: FwData, pos: LL, limit = 3): Nearest[] {
  const out: Nearest[] = []
  for (const region of data.regions) {
    for (const area of region.areas) {
      const c = areaCoords(area)
      if (!c) continue
      out.push({ place: { region, area, label: placeLabel(area) }, km: haversineKm(pos, c) })
    }
  }
  return out.sort((x, y) => x.km - y.km).slice(0, limit)
}

export const placeLabel = (a: FwArea) => (a.province && a.province !== a.name ? `${a.name}, ${a.province}` : a.name)

// ---- Prices ----------------------------------------------------------------------------------
const median = (v: number[]) => {
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Typical pump price of a product in an area: median of brand midpoints (robust to one odd station). */
export function typicalPrice(a: FwArea, p: FwProduct) {
  const brands = a.prices[p]
  if (!brands) return null
  const v = Object.values(brands).map(([lo, hi]) => (lo + hi) / 2)
  return median(v)
}

export interface BrandRow { brand: string; lo: number; hi: number; mid: number }
export function brandRows(a: FwArea, p: FwProduct): BrandRow[] {
  const brands = a.prices[p] ?? {}
  return Object.entries(brands).map(([brand, [lo, hi]]) => ({ brand, lo, hi, mid: (lo + hi) / 2 })).sort((x, y) => x.mid - y.mid)
}

/** Cheapest big-brand price per product across an area, for the "who's cheapest" strip. */
export function cheapest(a: FwArea, p: FwProduct) {
  return brandRows(a, p)[0] ?? null
}

/**
 * Estimate for a position: inverse-distance-weighted blend of the nearest areas that report the product.
 * Returns null when nothing is within `maxKm` so we never claim precision we don't have.
 */
export function estimateAt(data: FwData, pos: LL, p: FwProduct, maxKm = 60) {
  const near = nearestAreas(data, pos, 12).filter((n) => n.km <= maxKm)
  const used = near.map((n) => ({ n, price: typicalPrice(n.place.area, p) })).filter((x): x is { n: Nearest; price: number } => x.price !== null).slice(0, 3)
  if (!used.length) return null
  const w = used.map((u) => 1 / Math.max(u.n.km, 3)) // floor avoids dividing by ~0 when standing in the city centre
  const sum = w.reduce((a, b) => a + b, 0)
  const price = used.reduce((a, u, i) => a + u.price * w[i], 0) / sum
  const spread = Math.max(...used.map((u) => u.price)) - Math.min(...used.map((u) => u.price))
  return { price, used: used.map((u) => u.n), spread }
}

export const daysOld = (iso: string, today = new Date()) => Math.floor((today.getTime() - new Date(iso + 'T00:00:00').getTime()) / 86400000)

export type Freshness = 'current' | 'aging' | 'stale'
/** Weekly reports: the week itself and a few days after are current; beyond ~2 weeks we warn. */
export function freshness(weekEnd: string, today = new Date()): Freshness {
  const d = daysOld(weekEnd, today)
  return d <= 7 ? 'current' : d <= 14 ? 'aging' : 'stale'
}

export function parseFuelData(raw: unknown): FwData | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<FwData>
  if (d.schema !== 1 || !Array.isArray(d.regions)) return null
  const regions = d.regions.filter((r): r is FwRegion => !!r && typeof r.id === 'string' && Array.isArray(r.areas))
  return { schema: 1, generatedAt: String(d.generatedAt ?? ''), source: String(d.source ?? ''), problems: d.problems, regions }
}
