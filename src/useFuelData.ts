import { useEffect, useState } from 'react'
import { parseFuelData, type FwData } from './pricing'

const DATA_URL = `${import.meta.env.BASE_URL}fuel-prices.json`

type Status = 'loading' | 'ready' | 'error'

// One shared copy for the whole app: Fuel Watch and the vehicle form both need the same file, and it should be
// downloaded once per visit, not once per screen.
let cache: FwData | null = null
let inflight: Promise<FwData | null> | null = null

function load(force: boolean): Promise<FwData | null> {
  if (cache && !force) return Promise.resolve(cache)
  if (inflight && !force) return inflight
  inflight = fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 3600000)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) => {
      const d = parseFuelData(j)
      if (d && d.regions.length) cache = d
      return cache
    })
    .catch(() => null)
    .finally(() => { inflight = null })
  return inflight
}

/** Load the DOE price file (shared and cached). `reload` forces a fresh download, e.g. after an error. */
export function useFuelData() {
  const [data, setData] = useState<FwData | null>(cache)
  const [state, setState] = useState<Status>(cache ? 'ready' : 'loading')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    if (!cache || tick > 0) setState('loading')
    load(tick > 0).then((d) => {
      if (!live) return
      if (d) { setData(d); setState('ready') } else setState('error')
    })
    return () => { live = false }
  }, [tick])
  return { data, state, reload: () => setTick((t) => t + 1) }
}
