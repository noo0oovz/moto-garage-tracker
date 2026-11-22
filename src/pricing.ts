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
export interface FwAdjustment {
  weekStart: string
  weekEnd: string
  source: string
  /** brand -> product group -> signed change in PHP per litre announced for that week */
  brands: Record<string, Partial<Record<'gasoline' | 'diesel' | 'kerosene', number>>>
}
export interface FwData {
  schema: number
  generatedAt: string
  source: string
  problems?: string[]
  regions: FwRegion[]
  adjustments: FwAdjustment[]
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
// Visayas provinces and cities. Cities carry their own coordinates; provinces are the fallback centre.
const VIS_PROVINCE: Record<string, LL> = {
  Aklan: [11.7, 122.35], Antique: [11.0, 122.1], Capiz: [11.45, 122.75], Guimaras: [10.6, 122.6], Iloilo: [10.95, 122.55],
  Bohol: [9.85, 124.15], Cebu: [10.3, 123.9], Biliran: [11.55, 124.45], 'Eastern Samar': [11.5, 125.5], Leyte: [10.9, 124.9],
  'Northern Samar': [12.4, 124.6], Samar: [11.9, 125.0], 'Southern Leyte': [10.3, 125.1], 'Negros Occidental': [10.4, 123.0],
  'Negros Oriental': [9.4, 123.1], Siquijor: [9.2, 123.55],
}
const VIS_CITY: Record<string, LL> = {
  Boracay: [11.97, 121.92], Kalibo: [11.7, 122.37], 'Roxas City': [11.59, 122.75], 'Iloilo City': [10.72, 122.56],
  'Cebu City': [10.32, 123.89], 'Mandaue City': [10.32, 123.94], 'Lapu-Lapu City': [10.31, 123.95], 'Talisay City': [10.24, 123.84],
  'Danao City': [10.52, 124.03], 'Carcar City': [10.11, 123.64], 'Naga City': [10.21, 123.76], 'Bogo City': [11.05, 124.0],
  'Tagbilaran City': [9.65, 123.85], 'Ormoc City': [11.0, 124.61], 'Baybay City': [10.68, 124.8], 'Tacloban City': [11.24, 125.0],
  'Maasin City': [10.13, 124.84], 'Catbalogan City': [11.78, 124.89], 'Calbayog City': [12.07, 124.6], 'Borongan City': [11.61, 125.43],
  'Dumaguete City': [9.31, 123.31], 'Bais City': [9.59, 123.12], 'Bayawan City': [9.37, 122.8], 'Canlaon City': [10.39, 123.2],
  'Kabankalan City': [9.99, 122.82], 'San Carlos City': [10.49, 123.42], 'Guihulngan City': [10.12, 123.27],
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
// City names are matched with the word "city" kept, so "Quezon City" (Metro Manila) is never confused with the
// town of Quezon in Bukidnon or the province of Quezon. "Dasmariñas" and "Dasmariñas City" are both accepted.
const keepCity = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
const CITY_N = new Map<string, LL>()
for (const [k, v] of Object.entries({ ...CITY, ...VIS_CITY })) {
  CITY_N.set(keepCity(k), v)
  if (/ city$/.test(keepCity(k)) === false) CITY_N.set(keepCity(k) + ' city', v)
}
const PROV_N = new Map(Object.entries({ ...PROVINCE, ...VIS_PROVINCE }).map(([k, v]) => [norm(k), v]))

/** Best-known centre for an area: its own city, else its province (either as a field or as the name). */
export function areaCoords(a: FwArea): LL | null {
  // A town's own name may coincide with a different province's (Quezon, Bukidnon vs. Quezon province). Only treat
  // the name as a province when the DOE row carries no province of its own (e.g. "Masbate", "Palawan").
  const full = keepCity(a.name)
  // A name written without "City" (the DOE sometimes prints "Bacoor", sometimes "Bacoor City") still finds the
  // city - but only when the area has no province of its own to say it is a different place (Quezon, Bukidnon).
  const bare = a.province === '' && !/ city$/.test(full) ? CITY_N.get(full + ' city') : undefined
  return CITY_N.get(full) ?? bare ?? PROV_N.get(norm(a.province)) ?? (a.province === '' ? PROV_N.get(norm(a.name)) : undefined) ?? null
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
  if ((d.schema !== 1 && d.schema !== 2) || !Array.isArray(d.regions)) return null
  const regions = d.regions.filter((r): r is FwRegion => !!r && typeof r.id === 'string' && Array.isArray(r.areas))
  const adjustments = (Array.isArray(d.adjustments) ? d.adjustments : []).filter(
    (a): a is FwAdjustment => !!a && typeof a.weekStart === 'string' && typeof a.weekEnd === 'string' && !!a.brands && typeof a.brands === 'object',
  )
  return { schema: d.schema, generatedAt: String(d.generatedAt ?? ''), source: String(d.source ?? ''), problems: d.problems, regions, adjustments }
}

// ---- Announced weekly adjustments -------------------------------------------------------------
export const productGroup = (p: FwProduct): 'gasoline' | 'diesel' | 'kerosene' =>
  p === 'DIESEL' || p === 'DIESEL PLUS' ? 'diesel' : p === 'KEROSENE' ? 'kerosene' : 'gasoline'

const addDaysISO = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export interface Projected {
  lo: number
  hi: number
  /** net change applied, PHP/L */
  delta: number
  /** weeks (start dates) whose announced change was applied */
  weeks: string[]
}

/**
 * Project a measured brand price forward using the oil companies' announced weekly changes.
 *
 * Only returns a value when the chain is complete: the measured week must be followed, week by week, by an
 * adjustment for this brand and fuel group, up to the latest week that has started. A missing week or a brand
 * that did not announce a change returns null - we never bridge a gap with a guess.
 */
export function projectPrice(
  data: FwData, regionWeekStart: string, brand: string, product: FwProduct, range: [number, number], today: string,
): Projected | null {
  const group = productGroup(product)
  const byStart = new Map(data.adjustments.map((a) => [a.weekStart, a]))
  let week = addDaysISO(regionWeekStart, 7)
  let delta = 0
  const weeks: string[] = []
  while (week <= today) {
    const adj = byStart.get(week)
    const v = adj?.brands[brand]?.[group]
    if (v === undefined) return null // gap in the chain
    delta += v
    weeks.push(week)
    week = addDaysISO(week, 7)
  }
  if (!weeks.length) return null // already current: nothing to project
  return { lo: Math.round((range[0] + delta) * 100) / 100, hi: Math.round((range[1] + delta) * 100) / 100, delta: Math.round(delta * 100) / 100, weeks }
}

/** The latest week for which adjustments exist and have started. */
export function latestAdjustmentWeek(data: FwData, today: string) {
  return [...data.adjustments].filter((a) => a.weekStart <= today).sort((x, y) => (x.weekStart < y.weekStart ? 1 : -1))[0] ?? null
}

// ---- Area search -------------------------------------------------------------------------------
export interface SearchHit { key: string; region: FwRegion; area: FwArea; label: string; score: number }
export const areaKey = (r: FwRegion, a: FwArea) => `${r.id}|${a.province}|${a.name}`

/**
 * Find areas by typing part of a city, province or region name. Accent- and case-insensitive; every typed word
 * must match somewhere (so "davao sur" finds Davao del Sur). Better matches rank first: exact name, then names
 * that start with the query, then word starts, then anywhere.
 */
export function searchAreas(data: FwData, query: string, limit = 12): SearchHit[] {
  const words = norm(query).split(' ').filter(Boolean)
  if (!words.length) return []
  const hits: SearchHit[] = []
  for (const region of data.regions) {
    for (const area of region.areas) {
      const name = norm(area.name)
      const hay = `${name} ${norm(area.province)} ${norm(region.label)}`
      if (!words.every((w) => hay.includes(w))) continue
      const q = words.join(' ')
      let score = 4
      if (name === q) score = 0
      else if (name.startsWith(q)) score = 1
      else if (words.every((w) => name.split(' ').some((t) => t.startsWith(w)))) score = 2
      else if (words.every((w) => hay.split(' ').some((t) => t.startsWith(w)))) score = 3
      hits.push({ key: areaKey(region, area), region, area, label: placeLabel(area), score })
    }
  }
  return hits.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label)).slice(0, limit)
}

export interface AreaPrice {
  price: number
  /** how many brand prices were projected forward with announced changes vs. left as measured */
  projected: number
  measured: number
}

/**
 * Typical current price in an area: the median over brands of the estimated price when a complete chain of
 * announced changes exists for that brand, otherwise the last measured midpoint. Brands are never mixed silently:
 * the counts say how many were projected.
 */
export function typicalCurrent(data: FwData, region: FwRegion, a: FwArea, p: FwProduct, today: string): AreaPrice | null {
  const mids: number[] = []
  let projected = 0
  for (const r of brandRows(a, p)) {
    const proj = projectPrice(data, region.weekStart, r.brand, p, [r.lo, r.hi], today)
    if (proj) { mids.push((proj.lo + proj.hi) / 2); projected++ } else mids.push(r.mid)
  }
  const m = median(mids)
  return m === null ? null : { price: m, projected, measured: mids.length - projected }
}

// ---- Towns DOE does not monitor ------------------------------------------------------------------
// DOE reports a selected set of cities and municipalities, so many towns people look for are missing (e.g. San
// Mateo, Rizal). For those we offer the nearest monitored areas instead of a dead end. Only towns whose position
// is well known are listed; anything else still gets the "no match" message.
const UNLISTED: [string, string, LL][] = [
  ['San Mateo', 'Rizal', [14.696, 121.121]], ['Rodriguez (Montalban)', 'Rizal', [14.76, 121.14]], ['Cainta', 'Rizal', [14.578, 121.122]],
  ['Taytay', 'Rizal', [14.57, 121.133]], ['Angono', 'Rizal', [14.527, 121.153]], ['Binangonan', 'Rizal', [14.465, 121.192]],
  ['Pateros', 'Metro Manila', [14.545, 121.068]], ['San Juan', 'Metro Manila', [14.6, 121.03]], ['Mandaluyong', 'Metro Manila', [14.579, 121.036]],
  ['Las Piñas', 'Metro Manila', [14.45, 120.98]], ['Malabon', 'Metro Manila', [14.66, 120.957]], ['Bulacan (Meycauayan)', 'Bulacan', [14.737, 120.96]],
  ['San Jose del Monte', 'Bulacan', [14.81, 121.05]], ['Malolos', 'Bulacan', [14.843, 120.811]], ['Marilao', 'Bulacan', [14.757, 120.95]],
  ['Santa Maria', 'Bulacan', [14.82, 121.0]], ['Sta. Rosa', 'Laguna', [14.31, 121.11]], ['Silang', 'Cavite', [14.23, 120.97]],
]

export interface NearbyFallback { town: string; province: string; near: Nearest[] }

/** When a search finds nothing, see if it names a known unmonitored town and return the closest monitored areas. */
export function nearbyFallback(data: FwData, query: string): NearbyFallback | null {
  const q = norm(query)
  if (q.length < 3) return null
  const hit = UNLISTED.find(([name, prov]) => {
    const n = norm(name)
    return n.includes(q) || q.includes(n) || (norm(`${name} ${prov}`).includes(q) && q.split(' ').length > 1)
  })
  if (!hit) return null
  // Province-only entries (the DOE lists e.g. "Quezon" as a whole province) sit at the province centre, so they
  // are not a real "nearby place" and would sit confusingly beside e.g. Quezon City.
  const near = nearestAreas(data, hit[2], 8).filter((n) => n.km <= 40 && !(n.place.area.province === '' && PROV_N.has(norm(n.place.area.name)))).slice(0, 3)
  return near.length ? { town: hit[0], province: hit[1], near } : null
}
