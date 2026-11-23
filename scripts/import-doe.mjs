// Weekly importer: DOE price-monitoring PDFs + weekly price-adjustment notices -> public/fuel-prices.json
//
// Usage:  node scripts/import-doe.mjs [--out public/fuel-prices.json] [--prev public/fuel-prices.json]
//
// Safety rules (the whole point of this script):
//  * every price row must reconcile with the PDF's own OVERALL RANGE column, else it is dropped;
//  * a region is only published if it yields enough verified areas;
//  * a region that fails this week keeps its previous data (its own week stamp makes the age visible);
//  * scanned/image-only reports (e.g. North Luzon) are skipped, never OCR'd;
//  * if nothing at all can be verified we exit non-zero and leave the previous JSON untouched.
import fs from 'node:fs'
import path from 'node:path'
import { openPdf, parseDocument } from './doe-parse.mjs'
import { parseAdjustments } from './adjust-parse.mjs'
import { parseWeek } from './week.mjs'

const SITE = 'https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices/'
const REGIONS = [
  { id: 'ncr', label: 'NCR', page: 'ncr-pump-prices', minAreas: 8 },
  { id: 'south-luzon', label: 'South Luzon', page: 'south-luzon-pump-prices', minAreas: 8 },
  { id: 'visayas', label: 'Visayas', page: 'visayas-pump-prices', minAreas: 20 },
  { id: 'mindanao', label: 'Mindanao', page: 'mindanao-pump-prices', minAreas: 20 },
  // north-luzon: most pages are scanned images with no text layer, so it cannot be verified (see README)
]
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; MotoGaragePH-importer; +https://github.com/noo0oovz/moto-garage-tracker)' }

const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const OUT = arg('--out', 'public/fuel-prices.json')
const PREV = arg('--prev', 'public/fuel-prices.json')

/** GET with a hard timeout and a couple of retries: DOE's CDN occasionally stalls, and a hung request would otherwise hold the job for hours. */
async function get(url, binary, attempts = 3) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 30000)
    try {
      const res = await fetch(url, { headers: UA, signal: ctl.signal })
      if (!res.ok) {
        // 4xx will not get better by retrying; 5xx and 429 might.
        if (res.status < 500 && res.status !== 429) throw Object.assign(new Error(`${res.status} ${url}`), { fatal: true })
        throw new Error(`${res.status} ${url}`)
      }
      return binary ? Buffer.from(await res.arrayBuffer()) : await res.text()
    } catch (e) {
      lastErr = e.name === 'AbortError' ? new Error(`timeout after 30s: ${url}`) : e
      if (e.fatal || i === attempts) break
      await new Promise((r) => setTimeout(r, 1500 * i))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

function pdfLinks(html) {
  const out = []
  const re = /<a[^>]*href="(https:\/\/d24qbtp4vooyzi\.cloudfront\.net[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  for (let m; (m = re.exec(html)); ) {
    const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (/^(download|open in new tab)$/i.test(label)) continue
    out.push({ url: m[1].replace(/&amp;/g, '&'), label })
  }
  return out
}

/** "November 17 to 23" / "October 27 to November 2" -> week, using the year of the page (listing groups by year). */
function weekFromLabel(label, year) {
  return parseWeek(`${label.replace(/\bto\b/i, '-')} ${year}`)
}

// DOE weeks run in Philippine time. Using the UTC date would make a run between 00:00 and 08:00 PH time think it is
// still the previous day and skip a week that has just started.
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

async function importRegion(region, td) {
  const html = await get(SITE + region.page, false)
  const links = pdfLinks(html)
  const year = new Date().getFullYear()
  // Candidates: links whose label is a readable week that has already started, newest first.
  const dated = links
    .map((l) => ({ ...l, week: weekFromLabel(l.label, year) }))
    .filter((l) => l.week && l.week.start <= td)
    .sort((a, b) => (a.week.start < b.week.start ? 1 : -1))
  // South Luzon files are labelled by sub-region rather than week; fall back to probing them all.
  const candidates = dated.length ? dated : links.map((l) => ({ ...l, week: null }))
  const tried = []
  const groups = new Map() // weekStart -> { week, areas, sources }
  for (const l of candidates.slice(0, region.id === 'south-luzon' ? 40 : 4)) {
    let parsed
    try { parsed = await parseDocument(await openPdf(await get(l.url, true))) } catch (e) { tried.push(`${l.label}: ${e.message}`); continue }
    // Prefer the week printed in the PDF; fall back to the listing label (Visayas prints no dates).
    const pdfWeek = parseWeek(parsed.weekText)
    const week = pdfWeek ?? l.week
    if (!week || week.start > td) continue
    if (pdfWeek && l.week && pdfWeek.start !== l.week.start) tried.push(`${l.label}: PDF says ${pdfWeek.start}, listing says ${l.week.start}; trusting the PDF`)
    const areas = parsed.areas.filter((a) => Object.keys(a.prices).length)
    if (!areas.length) { tried.push(`${l.label}: no verified rows`); continue }
    const g = groups.get(week.start) ?? { week, areas: [], sources: [] }
    g.areas.push(...areas); g.sources.push(l.url)
    groups.set(week.start, g)
    // Single-file regions: the newest started week that verifies is all we need.
    if (region.id !== 'south-luzon' && g.areas.length >= region.minAreas) break
  }
  const best = [...groups.values()].sort((a, b) => (a.week.start < b.week.start ? 1 : -1))[0]
  if (!best) return { problems: [`${region.id}: no readable report (${tried.join('; ') || 'none tried'})`] }
  const seen = new Set()
  const areas = best.areas.filter((a) => { const k = `${a.province}|${a.name}`; if (seen.has(k)) return false; seen.add(k); return true })
  if (areas.length < region.minAreas) return { problems: [`${region.id}: only ${areas.length} verified areas (< ${region.minAreas}); not published`] }
  return { region: { id: region.id, label: region.label, weekStart: best.week.start, weekEnd: best.week.end, sources: best.sources, areas }, problems: tried }
}

/** Weekly announced price changes, newest started week first. */
async function importAdjustments(td) {
  const html = await get(SITE + 'price-adjustments', false)
  const links = pdfLinks(html).filter((l) => /price adjust|prior notice|adjustment/i.test(l.label + l.url))
  const weeks = []
  const seen = new Set()
  for (const l of links) {
    if (seen.has(l.url)) continue
    seen.add(l.url)
    let r
    try { r = await parseAdjustments(await get(l.url, true)) } catch { continue }
    if (!r.week || !Object.keys(r.brands).length) continue
    weeks.push({ weekStart: r.week.start, weekEnd: r.week.end, source: l.url, brands: r.brands })
    if (weeks.length >= 6) break
  }
  // Only weeks that have started count: the notice for the coming week is posted on the Monday before.
  return weeks.filter((w) => w.weekStart <= td).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
}

async function main() {
  const td = today()
  let prev = null
  try { prev = JSON.parse(fs.readFileSync(PREV, 'utf8')) } catch { /* first run */ }
  const problems = []
  const regions = []
  for (const region of REGIONS) {
    let r
    try { r = await importRegion(region, td) } catch (e) { r = { problems: [`${region.id}: ${e.message}`] } }
    problems.push(...(r.problems ?? []))
    if (r.region) {
      const old = prev?.regions?.find((x) => x.id === region.id)
      // Never replace newer data with older data (DOE sometimes reorders or reposts).
      if (old && old.weekStart > r.region.weekStart) { regions.push(old); problems.push(`${region.id}: kept newer previous week ${old.weekStart}`) }
      // A half-broken parse can still clear the minimum. If the new week has far fewer areas than the last one, the
      // layout probably changed: keep the good data and say why, rather than publishing a shrunken region.
      else if (old && old.areas.length >= 10 && r.region.areas.length < old.areas.length * 0.6) {
        regions.push(old)
        problems.push(`${region.id}: new week has ${r.region.areas.length} areas vs ${old.areas.length} before; kept previous data (parser may need attention)`)
      }
      else regions.push(r.region)
      console.log(`${region.id}: ${r.region.areas.length} areas, week ${r.region.weekStart}..${r.region.weekEnd}`)
    } else {
      const old = prev?.regions?.find((x) => x.id === region.id)
      if (old) { regions.push(old); problems.push(`${region.id}: kept previous data from week ${old.weekStart}`) }
    }
  }
  let adjustments = []
  try { adjustments = await importAdjustments(td) } catch (e) { problems.push(`adjustments: ${e.message}`) }
  // Zero weeks parsed from a page that used to yield several means the layout changed, not that there are no
  // adjustments: keep what we had instead of wiping the estimate chain for every user.
  if (!adjustments.length && prev?.adjustments?.length) { adjustments = prev.adjustments; problems.push('adjustments: none parsed; kept previous weeks') }
  // Keep older weeks the page no longer lists, so a chain that spans a gap in DOE's listing is not broken.
  if (prev?.adjustments?.length) {
    const have = new Set(adjustments.map((a) => a.weekStart))
    adjustments = [...adjustments, ...prev.adjustments.filter((a) => !have.has(a.weekStart))].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)).slice(0, 12)
  }
  if (adjustments.length) console.log(`adjustments: ${adjustments.map((a) => a.weekStart).join(', ')}`)

  if (!regions.length) { console.error('Nothing verified; leaving existing data untouched.\n' + problems.join('\n')); process.exit(1) }
  const doc = {
    schema: 2, generatedAt: new Date().toISOString(),
    source: 'Philippines Department of Energy - Price Monitoring of Liquid Fuels and Price Adjustment notices',
    problems, regions, adjustments,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(doc))
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`)
  if (problems.length) console.log('notes:\n  ' + problems.join('\n  '))
}

main()
