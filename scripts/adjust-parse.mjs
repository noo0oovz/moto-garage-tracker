// Parse a DOE "Summary of Prior Notice on Price Adjustments" PDF into per-company weekly changes (PHP/L).
//
// The table has three product columns (Gasoline, Diesel, Kerosene). Each company occupies one row block and
// each cell is a signed number such as -1.50 or 3.50. We read by column position, never by order, and a cell is
// only accepted if it sits under a column header.
import { openPdf } from './doe-parse.mjs'
import { parseWeek } from './week.mjs'

const CELL = /^[-+−]?\d{1,2}\.\d{2}$/
const COMPANY_NOISE = /^(oil company|date|time|text|message|was|received|effectivity|of|products|gasoline|diesel|kerosene|summary|for|the|week|prior|notice|on|price|adjustments)\b/i
const BRAND_MAP = [
  ['PETRON', /petron/i], ['SHELL', /shell/i], ['CALTEX', /caltex/i], ['PHOENIX', /phoenix/i], ['TOTAL', /^total/i],
  ['FLYING V', /flying/i], ['UNIOIL', /unioil/i], ['SEAOIL', /seaoil/i], ['PTT', /^ptt/i], ['JETTI', /jetti/i],
  ['CLEAN FUEL', /clean\s*fuel/i], ['MY GAS', /my\s*gas/i],
]

const num = (s) => parseFloat(s.replace('−', '-'))

export async function parseAdjustments(data) {
  const doc = await openPdf(data)
  const rows = []
  let weekText = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const items = tc.items.filter((i) => i.str.trim()).map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, s: i.str.trim() }))
    if (!weekText) {
      const t = items.map((i) => i.s).join(' ')
      const m = t.match(/week\s+([A-Za-z]+\s*\d{1,2}\s*-\s*(?:[A-Za-z]+\s*)?\d{1,2},?\s*20\d\d)/i)
      if (m) weekText = m[1]
    }
    const head = (re) => items.find((i) => re.test(i.s))
    const g = head(/^Gasoline$/i), d = head(/^Diesel$/i), k = head(/^Kerosene$/i)
    if (!g || !d || !k) continue
    const cols = [['gasoline', g], ['diesel', d], ['kerosene', k]].map(([key, it]) => ({ key, x: it.x + it.w / 2 }))
    const tol = 28
    // company labels sit in the left column (x well left of the Gasoline header)
    const companyItems = items.filter((i) => i.x < g.x - 120 && !COMPANY_NOISE.test(i.s) && !/^\d/.test(i.s) && i.y < g.y - 8)
    const cells = items.filter((i) => CELL.test(i.s) && i.y < g.y - 8)
    for (const c of cells) {
      const col = cols.find((x) => Math.abs(c.x + c.w / 2 - x.x) <= tol)
      if (!col) continue
      // The company is the nearest label on (or just around) the cell's line; multi-line names are joined.
      const near = companyItems.filter((i) => Math.abs(i.y - c.y) <= 14).sort((a, b) => b.y - a.y)
      if (!near.length) continue
      const name = near.map((i) => i.s).join(' ')
      rows.push({ company: name, product: col.key, delta: num(c.s), y: c.y })
    }
  }
  // fold into brand -> product -> deltas
  const byBrand = {}
  for (const r of rows) {
    const brand = BRAND_MAP.find(([, re]) => re.test(r.company))?.[0]
    if (!brand) continue
    const b = (byBrand[brand] ??= {})
    ;(b[r.product] ??= []).push(r.delta)
  }
  const out = {}
  for (const [brand, prods] of Object.entries(byBrand)) {
    out[brand] = {}
    for (const [prod, vals] of Object.entries(prods)) {
      // A company posts one figure per product; if several rows disagree (revisions), keep the latest (lowest on the page).
      out[brand][prod] = vals[vals.length - 1]
    }
  }
  return { week: parseWeek(weekText), weekText, brands: out, rowCount: rows.length }
}
