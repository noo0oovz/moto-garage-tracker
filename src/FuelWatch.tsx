import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Fuel, LocateFixed, MapPin, RefreshCw, TriangleAlert } from 'lucide-react'
import { Empty } from './ui'
import { useStore } from './store'
import { fmtDate, peso } from './logic'
import {
  FW_PRODUCTS, brandRows, estimateAt, freshness, nearestAreas, parseFuelData, placeLabel, typicalPrice,
  type FwArea, type FwData, type FwProduct, type FwRegion,
} from './pricing'

const DATA_URL = `${import.meta.env.BASE_URL}fuel-prices.json`
const DOE_URL = 'https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices'
const MAX_NEAR_KM = 60
const LS_AREA = 'motogarage-fw-area'
const LS_PRODUCT = 'motogarage-fw-product'

function ls(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

const BRAND_STYLE: Record<string, string> = {
  PETRON: 'bg-blue-500', SHELL: 'bg-yellow-400', CALTEX: 'bg-red-500', PHOENIX: 'bg-orange-500', TOTAL: 'bg-rose-500',
  'FLYING V': 'bg-green-500', UNIOIL: 'bg-sky-500', SEAOIL: 'bg-cyan-500', PTT: 'bg-indigo-500', JETTI: 'bg-lime-500', 'MY GAS': 'bg-teal-500', 'CLEAN FUEL': 'bg-emerald-500', INDEPENDENT: 'bg-slate-400',
}
const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase())

function useFuelData() {
  const [data, setData] = useState<FwData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setState('loading')
    fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 3600000)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        const d = parseFuelData(j)
        if (!live) return
        if (!d || !d.regions.length) setState('error')
        else { setData(d); setState('ready') }
      })
      .catch(() => live && setState('error'))
    return () => { live = false }
  }, [tick])
  return { data, state, reload: () => setTick((t) => t + 1) }
}

function FreshBadge({ region }: { region: FwRegion }) {
  const f = freshness(region.weekEnd)
  const tone = f === 'current' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : f === 'aging' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {f !== 'current' && <TriangleAlert size={12} />} Week of {fmtDate(region.weekStart)}–{fmtDate(region.weekEnd)}{f === 'stale' ? ' · outdated' : ''}
    </span>
  )
}

export function FuelWatchPage() {
  const { vehicle } = useStore()
  const { data, state, reload } = useFuelData()
  const defaultProduct: FwProduct = vehicle?.fuelType === 'Diesel' ? 'DIESEL' : 'RON 95'
  const [product, setProduct] = useState<FwProduct>(() => (FW_PRODUCTS as readonly string[]).includes(ls(LS_PRODUCT) ?? '') ? (ls(LS_PRODUCT) as FwProduct) : defaultProduct)
  const [areaKey, setAreaKey] = useState<string>(() => ls(LS_AREA) ?? '')
  const [geo, setGeo] = useState<{ status: 'idle' | 'asking' | 'denied' | 'unavailable' | 'ok'; pos?: [number, number]; acc?: number }>({ status: 'idle' })

  // Follow the active vehicle's fuel until the user picks a product themselves.
  useEffect(() => { if (!ls(LS_PRODUCT)) setProduct(defaultProduct) }, [defaultProduct])

  const areas = useMemo(() => {
    if (!data) return [] as { key: string; region: FwRegion; area: FwArea }[]
    return data.regions.flatMap((region) => region.areas.map((area) => ({ key: `${region.id}|${area.province}|${area.name}`, region, area })))
      .sort((a, b) => placeLabel(a.area).localeCompare(placeLabel(b.area)))
  }, [data])

  const locate = () => {
    if (!('geolocation' in navigator)) { setGeo({ status: 'unavailable' }); return }
    setGeo({ status: 'asking' })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ status: 'ok', pos: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy })
        setAreaKey('') // a fresh fix overrides a saved manual pick
        try { localStorage.removeItem(LS_AREA) } catch { /* ignore */ }
      },
      (e) => setGeo({ status: e.code === 1 ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    )
  }

  const selected = areas.find((a) => a.key === areaKey) ?? null
  const est = useMemo(() => (data && geo.pos ? estimateAt(data, geo.pos, product) : null), [data, geo.pos, product])
  const nearest = useMemo(() => (data && geo.pos ? nearestAreas(data, geo.pos, 3) : []), [data, geo.pos])
  // Follow the nearest area only when it is genuinely close; otherwise make the user choose rather than
  // present a price from a place 150 km away as if it were "near you".
  const nearOk = nearest[0] && nearest[0].km <= MAX_NEAR_KM ? nearest[0] : null
  const focus: { region: FwRegion; area: FwArea } | null = selected ?? (nearOk ? { region: nearOk.place.region, area: nearOk.place.area } : null)
  const outOfCoverage = geo.status === 'ok' && !!geo.pos && !nearOk && !selected

  if (state === 'loading') return <div className="page space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
  if (state === 'error' || !data) {
    return (
      <div className="page space-y-3">
        <Empty>
          Couldn’t load fuel prices. If you’re offline, reconnect and try again.
          <div className="mt-3 flex justify-center gap-2">
            <button className="btn-primary" onClick={reload}><RefreshCw size={16} /> Retry</button>
            <a className="btn-ghost" href={DOE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> DOE site</a>
          </div>
        </Empty>
      </div>
    )
  }

  const rows = focus ? brandRows(focus.area, product) : []
  // "Independent" is a bucket of unbranded stations, not a company, so it never wears the Lowest badge.
  const lowestBrand = rows.filter((r) => r.brand !== 'INDEPENDENT').length > 1 ? rows.find((r) => r.brand !== 'INDEPENDENT')?.brand : undefined
  const maxMid = Math.max(1, ...rows.map((r) => r.hi))
  const minMid = Math.min(...rows.map((r) => r.lo), maxMid)

  return (
    <div className="page space-y-4">
      {/* Location estimate */}
      <section className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-800 p-5 text-white shadow-lg" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm opacity-90">{geo.status === 'ok' && est ? 'Estimated price near you' : selected ? 'Typical price in your selected area' : 'Typical price'} · {titleCase(product)}</p>
            {est ? (
              <>
                <p className="my-1 text-4xl font-extrabold tracking-tight">{peso(est.price, 2)}<span className="text-lg font-semibold opacity-80"> /L</span></p>
                <p className="text-sm opacity-90">
                  Based on {est.used.map((u) => `${placeLabel(u.place.area)} (${Math.round(u.km)} km)`).join(', ')}
                  {est.spread > 1 ? ` · areas differ by up to ${peso(est.spread, 2)}` : ''}
                </p>
              </>
            ) : focus && typicalPrice(focus.area, product) !== null ? (
              <>
                <p className="my-1 text-4xl font-extrabold tracking-tight">{peso(typicalPrice(focus.area, product)!, 2)}<span className="text-lg font-semibold opacity-80"> /L</span></p>
                <p className="text-sm opacity-90">{placeLabel(focus.area)} · median of brand prices</p>
              </>
            ) : (
              <p className="my-2 text-base font-semibold">
                {outOfCoverage ? 'No verified DOE data within 60 km of you.' : 'Choose an area or use your location to see a price.'}
              </p>
            )}
          </div>
          <button onClick={locate} disabled={geo.status === 'asking'} className="btn shrink-0 bg-white/20 text-white hover:bg-white/30">
            <LocateFixed size={16} className={geo.status === 'asking' ? 'animate-pulse' : ''} /> {geo.status === 'asking' ? 'Locating…' : 'Use my location'}
          </button>
        </div>
        {geo.status === 'denied' && <p role="alert" className="mt-3 rounded-lg bg-black/25 p-2 text-sm">Location permission was blocked. Pick your area below instead, or allow location for this site in your browser settings.</p>}
        {geo.status === 'unavailable' && <p role="alert" className="mt-3 rounded-lg bg-black/25 p-2 text-sm">Couldn’t get your location. Pick your area below.</p>}
        {outOfCoverage && <p className="mt-3 rounded-lg bg-black/25 p-2 text-sm">DOE data in this app covers Metro Manila, Calabarzon, Bicol, Mimaropa and Mindanao for now. Pick the nearest area below to compare, or check the <a className="underline" href={DOE_URL} target="_blank" rel="noopener noreferrer">DOE site</a>.</p>}
        <p className="mt-3 text-xs opacity-80"><MapPin size={12} className="mb-0.5 mr-1 inline" />Your location stays on this device and is never sent anywhere. It’s used only to find the nearest monitored area.</p>
      </section>

      {/* Controls */}
      <section className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="label">Fuel</span>
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Fuel product">
            {FW_PRODUCTS.map((p) => (
              <button key={p} role="tab" aria-selected={product === p} onClick={() => { setProduct(p); lsSet(LS_PRODUCT, p) }}
                className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold transition ${product === p ? 'bg-orange-500 text-white' : 'border border-slate-300 text-slate-600 dark:border-white/10 dark:text-slate-300'}`}>
                {titleCase(p)}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="label">Area</span>
          <select className="field" value={areaKey} onChange={(e) => { setAreaKey(e.target.value); lsSet(LS_AREA, e.target.value) }}>
            <option value="">{nearOk ? `Nearest to me: ${placeLabel(nearOk.place.area)}` : 'Select an area…'}</option>
            {data.regions.map((r) => (
              <optgroup key={r.id} label={r.label}>
                {areas.filter((a) => a.region.id === r.id).map((a) => <option key={a.key} value={a.key}>{placeLabel(a.area)}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </section>

      {/* Brand comparison */}
      {focus && (
        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{placeLabel(focus.area)} · {titleCase(product)}</h2>
            <FreshBadge region={focus.region} />
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No verified {titleCase(product)} prices reported for this area this week. Try another fuel or a nearby area.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.brand}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={`h-2.5 w-2.5 rounded-full ${BRAND_STYLE[r.brand] ?? 'bg-slate-400'}`} aria-hidden />
                      {titleCase(r.brand)}{r.brand === 'INDEPENDENT' && <span className="text-xs font-normal text-slate-400">(unbranded stations)</span>}
                      {r.brand === lowestBrand && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Lowest</span>}
                    </span>
                    <span className="font-bold tabular-nums">{r.lo === r.hi ? peso(r.lo, 2) : `${peso(r.lo, 2)} – ${peso(r.hi, 2)}`}</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden>
                    <div className={`absolute inset-y-0 rounded-full ${BRAND_STYLE[r.brand] ?? 'bg-slate-400'}`}
                      style={{ left: `${((r.lo - minMid * 0.97) / (maxMid * 1.01 - minMid * 0.97)) * 100}%`, width: `${Math.max(2, ((r.hi - r.lo) / (maxMid * 1.01 - minMid * 0.97)) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Ranges are the lowest and highest station prices DOE monitored for each brand that week. Your station may differ.</p>
        </section>
      )}

      {/* Other nearby */}
      {geo.status === 'ok' && nearest.filter((n) => n.km <= MAX_NEAR_KM).length > 1 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Nearest monitored areas</h2>
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {nearest.filter((n) => n.km <= MAX_NEAR_KM).map((n) => (
              <li key={`${n.place.region.id}${n.place.label}`}>
                <button className="flex min-h-11 w-full items-center justify-between gap-2 py-1 text-left text-sm"
                  onClick={() => { const k = `${n.place.region.id}|${n.place.area.province}|${n.place.area.name}`; setAreaKey(k); lsSet(LS_AREA, k) }}>
                  <span className="min-w-0 truncate">{n.place.label} <span className="text-slate-400">· {Math.round(n.km)} km</span></span>
                  <span className="shrink-0 font-bold tabular-nums">{typicalPrice(n.place.area, product) !== null ? peso(typicalPrice(n.place.area, product)!, 2) : '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Source & coverage */}
      <section className="card space-y-2 p-4 text-xs text-slate-500 dark:text-slate-400">
        <p className="flex items-center gap-1 text-sm font-bold text-slate-700 dark:text-slate-200"><Fuel size={14} /> About this data</p>
        <p>Source: Department of Energy weekly “Price Monitoring of Liquid Fuels”, imported automatically and checked against each report’s own totals. These are monitored pump prices, not live prices at a specific station.</p>
        <ul className="flex flex-wrap gap-2">
          {data.regions.map((r) => <li key={r.id} className="flex items-center gap-1.5"><span className="font-semibold text-slate-700 dark:text-slate-200">{r.label}</span><FreshBadge region={r} /></li>)}
        </ul>
        <p>Not yet included: North Luzon and the Visayas (their reports can’t be verified automatically).</p>
        <p><a className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-500" href={DOE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open the latest DOE reports</a></p>
      </section>
    </div>
  )
}
