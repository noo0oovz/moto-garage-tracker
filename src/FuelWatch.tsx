import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ExternalLink, Fuel, Info, LocateFixed, MapPin, RefreshCw, Search, TriangleAlert, X } from 'lucide-react'
import { Empty } from './ui'
import { useStore } from './store'
import { fmtDate, peso } from './logic'
import {
  FW_PRODUCTS, areaKey as makeKey, brandRows, estimateAt, freshness, latestAdjustmentWeek, nearestAreas, parseFuelData, placeLabel,
  nearbyFallback, productGroup, projectPrice, searchAreas, typicalCurrent,
  type FwArea, type FwData, type FwProduct, type FwRegion,
} from './pricing'

const DATA_URL = `${import.meta.env.BASE_URL}fuel-prices.json`
const DOE_URL = 'https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices'
const MAX_NEAR_KM = 60
const LS_AREA = 'motogarage-fw-area'
const LS_PRODUCT = 'motogarage-fw-product'

function ls(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
// DOE weeks follow Philippine time, so "today" for price estimates is the Manila date wherever the user is.
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

const BRAND_STYLE: Record<string, string> = {
  PETRON: 'bg-blue-500', SHELL: 'bg-yellow-400', CALTEX: 'bg-red-500', PHOENIX: 'bg-orange-500', TOTAL: 'bg-rose-500',
  'FLYING V': 'bg-green-500', UNIOIL: 'bg-sky-500', SEAOIL: 'bg-cyan-500', PTT: 'bg-indigo-500', JETTI: 'bg-lime-500', 'MY GAS': 'bg-teal-500', 'CLEAN FUEL': 'bg-emerald-500', INDEPENDENT: 'bg-slate-400',
}
// User-facing island groups. "Luzon" is the South Luzon report (North Luzon is not available).
const GROUPS = [
  { id: 'ncr', label: 'NCR' },
  { id: 'south-luzon', label: 'Luzon' },
  { id: 'visayas', label: 'Visayas' },
  { id: 'mindanao', label: 'Mindanao' },
] as const
const groupLabel = (regionId: string) => GROUPS.find((g) => g.id === regionId)?.label ?? regionId
const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase())
// "−₱3.80" / "+₱3.50": the sign goes before the peso sign, with a real minus.
const signed = (n: number) => `${n < 0 ? '−' : '+'}${peso(Math.abs(n), 2)}`
const range = (lo: number, hi: number) => (lo === hi ? peso(lo, 2) : `${peso(lo, 2)} – ${peso(hi, 2)}`)

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
      {f !== 'current' && <TriangleAlert size={12} />} Measured {fmtDate(region.weekStart)}–{fmtDate(region.weekEnd)}{f === 'stale' ? ' · outdated' : ''}
    </span>
  )
}

/** Type-to-search combobox over every monitored area (WAI-ARIA combobox pattern: listbox + aria-activedescendant). */
function AreaSearch({ data, value, onPick, placeholder }: { data: FwData; value: string; onPick: (key: string) => void; placeholder: string }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const hits = useMemo(() => searchAreas(data, q, 10), [data, q])
  const fallback = useMemo(() => (hits.length === 0 ? nearbyFallback(data, q) : null), [data, q, hits.length])
  const selected = useMemo(() => {
    for (const r of data.regions) for (const a of r.areas) if (makeKey(r, a) === value) return placeLabel(a)
    return ''
  }, [data, value])

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])
  useEffect(() => setActive(0), [q])

  const pick = (key: string) => { onPick(key); setQ(''); setOpen(false) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && open && hits[active]) { e.preventDefault(); pick(hits[active].key) }
    else if (e.key === 'Escape') { setOpen(false) }
  }
  const show = open && q.trim().length > 0

  return (
    <div ref={box} className="relative min-w-0 max-w-full">
      <label htmlFor={`${id}-in`} className="label">Search city, province or region</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          id={`${id}-in`} role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={show && hits[active] ? `${id}-o${active}` : undefined}
          className="field pl-9 pr-10" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
          placeholder={selected || placeholder} value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        />
        {(q || value) && (
          <button type="button" aria-label={q ? 'Clear search' : 'Clear selected area'} onClick={() => { if (q) setQ(''); else onPick('') }}
            className="absolute right-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-slate-400 hover:text-slate-600"><X size={16} /></button>
        )}
      </div>
      {show && (
        <ul id={`${id}-list`} role="listbox" aria-label="Matching areas"
          className="anim-pop absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#131a26]">
          {hits.length === 0 && fallback ? (
            <>
              <li role="presentation" className="px-3 pb-1 pt-2 text-xs text-slate-500">
                DOE doesn’t monitor {fallback.town}, {fallback.province}. Nearest monitored areas:
              </li>
              {fallback.near.map((n) => {
                const k = makeKey(n.place.region, n.place.area)
                return (
                  <li key={k} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); pick(k) }}
                    className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-orange-500/10">
                    <span className="min-w-0 break-words font-medium">{n.place.label}</span>
                    <span className="shrink-0 text-xs text-slate-400">{Math.round(n.km)} km away</span>
                  </li>
                )
              })}
            </>
          ) : hits.length === 0 ? (
            <li role="presentation" className="px-3 py-3 text-sm text-slate-500">No monitored area matches “{q.trim()}”. DOE only reports selected cities and towns; try a nearby city or the province name.</li>
          ) : hits.map((h, i) => (
            <li key={h.key} id={`${id}-o${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(h.key) }} onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${i === active ? 'bg-orange-500/10' : ''}`}>
              <span className="min-w-0 break-words font-medium">{h.label}</span>
              <span className="shrink-0 text-xs text-slate-400">{groupLabel(h.region.id)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Browse by group (NCR / Luzon / Visayas / Mindanao), then pick a city; cities are split under their province. */
function BrowseAreas({ data, value, onPick }: { data: FwData; value: string; onPick: (key: string) => void }) {
  const groups = GROUPS.map((g) => ({ ...g, region: data.regions.find((r) => r.id === g.id) })).filter((g) => g.region)
  const selectedGroup = data.regions.find((r) => r.areas.some((a) => makeKey(r, a) === value))?.id
  const [open, setOpen] = useState<string>(selectedGroup ?? groups[0]?.id ?? '')
  useEffect(() => { if (selectedGroup) setOpen(selectedGroup) }, [selectedGroup])
  const current = groups.find((g) => g.id === open) ?? groups[0]
  const byProvince = useMemo(() => {
    const m = new Map<string, FwArea[]>()
    for (const a of current?.region?.areas ?? []) m.set(a.province, [...(m.get(a.province) ?? []), a])
    return [...m.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
      .map(([prov, list]) => [prov, [...list].sort((x, y) => x.name.localeCompare(y.name))] as const)
  }, [current])
  if (!current?.region) return null
  return (
    <section aria-label="Browse areas" className="min-w-0">
      <span className="label">Or browse by area</span>
      <div role="tablist" aria-label="Island group" className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-black/30">
        {groups.map((g) => (
          <button key={g.id} role="tab" aria-selected={g.id === current.id} onClick={() => setOpen(g.id)}
            className={`min-h-11 rounded-lg px-1 text-sm font-semibold transition ${g.id === current.id ? 'bg-orange-500 text-white shadow' : 'text-slate-500 dark:text-slate-300'}`}>
            {g.label}<span className="ml-1 hidden text-xs opacity-70 sm:inline">{g.region!.areas.length}</span>
          </button>
        ))}
      </div>
      {current.id === 'south-luzon' && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Calabarzon, Mimaropa and Bicol. North Luzon isn’t available yet.</p>}
      <div role="tabpanel" aria-label={`${current.label} cities`} className="mt-2 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-white/10">
        {byProvince.map(([prov, list]) => (
          <div key={prov || 'all'}>
            {prov && <h3 className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{prov}</h3>}
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((a) => {
                const k = makeKey(current.region!, a)
                return (
                  <li key={k}>
                    <button onClick={() => onPick(k)} aria-pressed={k === value}
                      className={`min-h-11 w-full rounded-lg px-2 text-left text-sm transition [@media(hover:hover)_and_(pointer:fine)]:lg:min-h-9 ${k === value ? 'bg-orange-500 font-semibold text-white' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                      <span className="line-clamp-2">{a.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export function FuelWatchPage() {
  const { vehicle } = useStore()
  const { data, state, reload } = useFuelData()
  const defaultProduct: FwProduct = vehicle?.fuelType === 'Diesel' ? 'DIESEL' : 'RON 95'
  const [product, setProduct] = useState<FwProduct>(() => (FW_PRODUCTS as readonly string[]).includes(ls(LS_PRODUCT) ?? '') ? (ls(LS_PRODUCT) as FwProduct) : defaultProduct)
  const [areaKey, setAreaKey] = useState<string>(() => ls(LS_AREA) ?? '')
  const [geo, setGeo] = useState<{ status: 'idle' | 'asking' | 'denied' | 'unavailable' | 'ok'; pos?: [number, number]; acc?: number }>({ status: 'idle' })
  const today = todayISO()

  // Follow the active vehicle's fuel until the user picks a product themselves.
  useEffect(() => { if (!ls(LS_PRODUCT)) setProduct(defaultProduct) }, [defaultProduct])

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
  const choose = (key: string) => { setAreaKey(key); lsSet(LS_AREA, key) }

  const selected = useMemo(() => {
    if (!data || !areaKey) return null
    for (const region of data.regions) for (const area of region.areas) if (makeKey(region, area) === areaKey) return { region, area }
    return null
  }, [data, areaKey])
  const est = useMemo(() => (data && geo.pos ? estimateAt(data, geo.pos, product) : null), [data, geo.pos, product])
  const nearest = useMemo(() => (data && geo.pos ? nearestAreas(data, geo.pos, 3) : []), [data, geo.pos])

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

  // Follow the nearest area only when it is genuinely close; otherwise make the user choose rather than
  // present a price from a place 150 km away as if it were "near you".
  const nearOk = nearest[0] && nearest[0].km <= MAX_NEAR_KM ? nearest[0] : null
  const focus: { region: FwRegion; area: FwArea } | null = selected ?? (nearOk ? { region: nearOk.place.region, area: nearOk.place.area } : null)
  const outOfCoverage = geo.status === 'ok' && !!geo.pos && !nearOk && !selected

  const rows = focus ? brandRows(focus.area, product) : []
  const group = productGroup(product)
  // Estimated current price per brand = measured range + announced changes since that week (only when the chain is complete).
  const projected = new Map(rows.map((r) => [r.brand, focus ? projectPrice(data, focus.region.weekStart, r.brand, product, [r.lo, r.hi], today) : null]))
  const anyProjected = [...projected.values()].some(Boolean)
  const latestAdj = latestAdjustmentWeek(data, today)
  const shown = rows.map((r) => ({ ...r, p: projected.get(r.brand) ?? null }))
  const lowestBrand = (() => {
    const named = shown.filter((r) => r.brand !== 'INDEPENDENT')
    if (named.length < 2) return undefined
    return [...named].sort((a, b) => ((a.p ? (a.p.lo + a.p.hi) / 2 : a.mid)) - ((b.p ? (b.p.lo + b.p.hi) / 2 : b.mid)))[0].brand
  })()
  // "Independent" is a bucket of unbranded stations, not a company, so it never wears the Lowest badge.
  const scaleLo = Math.min(...shown.map((r) => (r.p ? r.p.lo : r.lo)), Infinity)
  const scaleHi = Math.max(...shown.map((r) => (r.p ? r.p.hi : r.hi)), -Infinity)
  const span = Math.max(scaleHi - scaleLo, 0.5)
  const pos = (v: number) => `${((v - scaleLo) / span) * 94 + 3}%`

  const estimateOne = focus ? typicalCurrent(data, focus.region, focus.area, product, today) : null

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
                  Based on the last measured prices in {est.used.map((u) => `${placeLabel(u.place.area)} (${Math.round(u.km)} km)`).join(', ')}
                  {est.spread > 1 ? ` · areas differ by up to ${peso(est.spread, 2)}` : ''}
                </p>
              </>
            ) : focus && estimateOne !== null ? (
              <>
                <p className="my-1 text-4xl font-extrabold tracking-tight">{peso(estimateOne.price, 2)}<span className="text-lg font-semibold opacity-80"> /L</span></p>
                <p className="text-sm opacity-90">
                  {placeLabel(focus.area)} · median of brands ·{' '}
                  {estimateOne.projected > 0
                    ? `estimated now (measured ${fmtDate(focus.region.weekStart)} + announced changes)`
                    : `measured ${fmtDate(focus.region.weekStart)}`}
                </p>
              </>
            ) : (
              <p className="my-2 text-base font-semibold">
                {outOfCoverage ? 'No verified DOE data within 60 km of you.' : 'Search for your city, or use your location, to see a price.'}
              </p>
            )}
          </div>
          <button onClick={locate} disabled={geo.status === 'asking'} className="btn shrink-0 bg-white/20 text-white hover:bg-white/30">
            <LocateFixed size={16} className={geo.status === 'asking' ? 'animate-pulse' : ''} /> {geo.status === 'asking' ? 'Locating…' : 'Use my location'}
          </button>
        </div>
        {geo.status === 'denied' && <p role="alert" className="mt-3 rounded-lg bg-black/25 p-2 text-sm">Location permission was blocked. Search for your city below instead, or allow location for this site in your browser settings.</p>}
        {geo.status === 'unavailable' && <p role="alert" className="mt-3 rounded-lg bg-black/25 p-2 text-sm">Couldn’t get your location. Search for your city below.</p>}
        {outOfCoverage && <p className="mt-3 rounded-lg bg-black/25 p-2 text-sm">DOE reports for Metro Manila, Calabarzon, Bicol, Mimaropa, the Visayas and Mindanao are included. Search for the nearest city below, or check the <a className="underline" href={DOE_URL} target="_blank" rel="noopener noreferrer">DOE site</a>.</p>}
        <p className="mt-3 text-xs opacity-80"><MapPin size={12} className="mb-0.5 mr-1 inline" />Your location stays on this device and is never sent anywhere. It’s used only to find the nearest monitored area.</p>
      </section>

      {/* Controls */}
      <section className="grid min-w-0 gap-3 md:grid-cols-2 [&>*]:min-w-0">
        <AreaSearch data={data} value={areaKey} onPick={choose} placeholder={nearOk ? `Nearest to me: ${placeLabel(nearOk.place.area)}` : 'e.g. Davao, Parañaque, Cebu…'} />
        <div>
          <span className="label">Fuel</span>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Fuel product">
            {FW_PRODUCTS.map((p) => (
              <button key={p} role="tab" aria-selected={product === p} onClick={() => { setProduct(p); lsSet(LS_PRODUCT, p) }}
                className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold transition ${product === p ? 'bg-orange-500 text-white' : 'border border-slate-300 text-slate-600 dark:border-white/10 dark:text-slate-300'}`}>
                {titleCase(p)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <BrowseAreas data={data} value={areaKey} onPick={choose} />

      {/* Brand comparison */}
      {focus && (
        <section className="card p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{placeLabel(focus.area)} · {titleCase(product)}</h2>
            <FreshBadge region={focus.region} />
          </div>
          {anyProjected && latestAdj && (
            <p className="mb-3 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span><b className="text-orange-500">Est. now</b> adds the price change the oil companies announced for the week of {fmtDate(latestAdj.weekStart)} to the last measured price. Stations can differ; the measured range stays shown below.</span>
            </p>
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-slate-500">No verified {titleCase(product)} prices reported for this area this week. Try another fuel or a nearby area.</p>
          ) : (
            <ul className="space-y-4">
              {shown.map((r) => (
                <li key={r.brand}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={`h-2.5 w-2.5 rounded-full ${BRAND_STYLE[r.brand] ?? 'bg-slate-400'}`} aria-hidden />
                      {titleCase(r.brand)}{r.brand === 'INDEPENDENT' && <span className="text-xs font-normal text-slate-400">(unbranded stations)</span>}
                      {r.brand === lowestBrand && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Lowest</span>}
                    </span>
                    <span className="text-right tabular-nums">
                      {r.p ? (
                        <>
                          <span className="font-bold">{range(r.p.lo, r.p.hi)}</span>
                          <span className="ml-1.5 rounded bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">Est. now</span>
                        </>
                      ) : <span className="font-bold">{range(r.lo, r.hi)}</span>}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden>
                    <div className={`absolute inset-y-0 rounded-full ${BRAND_STYLE[r.brand] ?? 'bg-slate-400'}`}
                      style={{ left: pos(r.p ? r.p.lo : r.lo), width: `max(6px, ${((((r.p ? r.p.hi : r.hi) - (r.p ? r.p.lo : r.lo)) / span) * 94)}%)` }} />
                  </div>
                  {r.p ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Measured {fmtDate(focus.region.weekStart)}: {range(r.lo, r.hi)} · announced change {signed(r.p.delta)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {focus.region.weekStart >= (latestAdj?.weekStart ?? '9999') ? 'Measured this week.' : `Measured ${fmtDate(focus.region.weekStart)}. No announced change available to update it.`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {group === 'gasoline' && anyProjected ? 'Gasoline estimates are looser than diesel: in back-testing, stations passed on the announced change unevenly. ' : ''}
            Ranges are the lowest and highest station prices DOE monitored for each brand. Your station may differ.
          </p>
        </section>
      )}

      {/* Other nearby */}
      {geo.status === 'ok' && nearest.filter((n) => n.km <= MAX_NEAR_KM).length > 1 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Nearest monitored areas</h2>
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {nearest.filter((n) => n.km <= MAX_NEAR_KM).map((n) => (
              <li key={`${n.place.region.id}${n.place.label}`}>
                <button className="flex min-h-11 w-full items-center justify-between gap-2 py-1 text-left text-sm" onClick={() => choose(makeKey(n.place.region, n.place.area))}>
                  <span className="min-w-0 break-words">{n.place.label} <span className="text-slate-400">· {Math.round(n.km)} km</span></span>
                  <span className="shrink-0 font-bold tabular-nums">{(() => { const t = typicalCurrent(data, n.place.region, n.place.area, product, today); return t ? peso(t.price, 2) : '—' })()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Source & coverage */}
      <section className="card space-y-2 p-4 text-xs text-slate-500 dark:text-slate-400">
        <p className="flex items-center gap-1 text-sm font-bold text-slate-700 dark:text-slate-200"><Fuel size={14} /> About this data</p>
        <p>
          Source: Department of Energy. <b>Measured</b> prices come from its weekly “Price Monitoring of Liquid Fuels” reports; <b>Est. now</b> adds the weekly price changes oil companies notify the DOE of.
          Everything is imported automatically and each price row is checked against the report’s own totals. These are monitored pump prices, not live prices at a specific station.
        </p>
        <ul className="flex flex-wrap gap-2">
          {data.regions.map((r) => <li key={r.id} className="flex items-center gap-1.5"><span className="font-semibold text-slate-700 dark:text-slate-200">{r.label}</span><FreshBadge region={r} /></li>)}
        </ul>
        <p>Not included: North Luzon (its DOE reports are scanned images that can’t be read reliably). Data last checked {fmtDate(data.generatedAt.slice(0, 10))}.</p>
        <p><a className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-500" href={DOE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open the latest DOE reports</a></p>
      </section>
    </div>
  )
}
