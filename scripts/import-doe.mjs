// Weekly importer: DOE "Price Monitoring of Liquid Fuels" PDFs -> public/fuel-prices.json
//
// Usage:  node scripts/import-doe.mjs [--out public/fuel-prices.json] [--fixtures dir]
//
// Safety rules (the whole point of this script):
//  * every price row must reconcile with the PDF's own OVERALL RANGE column, else it is dropped;
//  * a region is only published if it yields enough verified areas;
//  * if nothing verifies we exit non-zero and leave the previous JSON untouched.
import fs from 'node:fs'
import path from 'node:path'
import { openPdf, parseDocument } from './doe-parse.mjs'
import { parseWeek } from './week.mjs'

const BASE = 'https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices/'
const REGIONS = [
  { id: 'ncr', label: 'NCR', page: 'ncr-pump-prices', minAreas: 8 },
  { id: 'south-luzon', label: 'South Luzon', page: 'south-luzon-pump-prices', minAreas: 8 },
  { id: 'mindanao', label: 'Mindanao', page: 'mindanao-pump-prices', minAreas: 20 },
  // north-luzon and visayas use layouts the parser cannot verify yet; see scripts/README.md
]
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; MotoGaragePH-importer; +https://github.com/noo0oovz/moto-garage-tracker)' }

const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const OUT = arg('--out', 'public/fuel-prices.json')

async function get(url, binary) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text()
}

function pdfLinks(html) {
  const out = []
  const re = /<a[^>]*href="(https:\/\/d24qbtp4vooyzi\.cloudfront\.net[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  for (let m; (m = re.exec(html)); ) out.push({ url: m[1].replace(/&amp;/g, '&'), label: m[2].replace(/<[^>]+>/g, '').trim() })
  return out
}

async function parseUrl(url) {
  const doc = await openPdf(await get(url, true))
  return parseDocument(doc)
}

/** Newest report whose week has already started (DOE posts the coming week early). */
async function latestFor(region, today) {
  const links = pdfLinks(await get(BASE + region.page, false))
  // South Luzon lists three sub-regions per week; others list one file per week. Probe newest-looking links first.
  const seen = new Set()
  const results = []
  for (const l of [...links].reverse().concat(links)) {
    if (seen.has(l.url)) continue
    seen.add(l.url)
    results.push(l)
  }
  return results
}

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  const regions = []
  const problems = []
  for (const region of REGIONS) {
    const links = await latestFor(region, today)
    const byWeek = new Map() // week.start -> { week, areas[] }
    let probed = 0
    // Probe links until we have the latest started week for this region (cap work; DOE keeps ~months of files).
    for (const l of links) {
      if (probed++ > 40) break
      let parsed
      try { parsed = await parseUrl(l.url) } catch (e) { problems.push(`${region.id}: ${e.message}`); continue }
      const week = parseWeek(parsed.weekText)
      if (!week || week.start > today) continue // unreadable, or a future week
      if (!parsed.areas.length) continue
      const entry = byWeek.get(week.start) ?? { week, areas: [], source: [] }
      entry.areas.push(...parsed.areas.filter((a) => Object.keys(a.prices).length))
      entry.source.push(l.url)
      byWeek.set(week.start, entry)
      // NCR/Mindanao: one file per week, so the first started week is the latest we need.
      if (region.id !== 'south-luzon' && byWeek.size >= 1 && week.start <= today) {
        // keep scanning only to see if a newer started week exists among the remaining links
      }
    }
    if (!byWeek.size) { problems.push(`${region.id}: no readable report`); continue }
    const newest = [...byWeek.values()].sort((a, b) => (a.week.start < b.week.start ? 1 : -1))[0]
    const seenNames = new Set()
    const areas = newest.areas.filter((a) => { const k = `${a.province}|${a.name}`; if (seenNames.has(k)) return false; seenNames.add(k); return true })
    if (areas.length < region.minAreas) { problems.push(`${region.id}: only ${areas.length} verified areas (< ${region.minAreas}); not published`); continue }
    regions.push({ id: region.id, label: region.label, weekStart: newest.week.start, weekEnd: newest.week.end, sources: newest.source, areas })
    console.log(`${region.id}: ${areas.length} areas, week ${newest.week.start}..${newest.week.end}`)
  }
  if (!regions.length) { console.error('Nothing verified; leaving existing data untouched.\n' + problems.join('\n')); process.exit(1) }
  const doc = { schema: 1, generatedAt: new Date().toISOString(), source: 'Philippines Department of Energy - Price Monitoring of Liquid Fuels', problems, regions }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(doc))
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`)
  if (problems.length) console.log('notes:\n  ' + problems.join('\n  '))
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('import-doe.mjs')) main()
