// Parse a DOE "Price Monitoring of Liquid Fuels" PDF into { area, product, brand, min, max } rows.
//
// Design rule: never guess. Every row's min/max is cross-checked against the PDF's own
// "OVERALL RANGE" columns; blocks that don't reconcile are dropped and counted.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

export const PRODUCTS = ['RON 100', 'RON 97', 'RON 95', 'RON 91', 'DIESEL', 'DIESEL PLUS', 'KEROSENE']
const PRODUCT_RE = /^(RON 100|RON 97|RON 95|RON 91|DIESEL PLUS|DIESEL|KEROSENE)$/
const BRANDS = ['PETRON', 'SHELL', 'CALTEX', 'PHOENIX', 'TOTAL', 'FLYING V', 'UNIOIL', 'SEAOIL', 'PTT', 'JETTI', 'MY GAS', 'CLEAN FUEL', 'INDEPENDENT']

const isPrice = (s) => /^\d{2,3}\.\d{2}$/.test(s)
const num = (s) => parseFloat(s)

async function pageItems(page) {
  const tc = await page.getTextContent()
  return tc.items
    .filter((i) => i.str.trim())
    .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, s: i.str.trim() }))
}

/** Cluster items that sit on (nearly) the same baseline. */
function toLines(items, tol = 2) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  for (const it of sorted) {
    const l = lines.find((ln) => Math.abs(ln.y - it.y) <= tol)
    if (l) l.items.push(it)
    else lines.push({ y: it.y, items: [it] })
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x))
  return lines
}

/**
 * Find the brand header: x-center of each brand column. Headers can be split across
 * lines (e.g. "FLYING" / "V"), so we collect the header zone as a whole.
 */
function findHeader(items) {
  const productHeader = items.find((i) => /^PRODUCT$/.test(i.s))
  if (!productHeader) return null
  const top = productHeader.y + 14
  const bottom = productHeader.y - 14
  const zone = items.filter((i) => i.y <= top && i.y >= bottom)
  const cols = []
  const words = zone.sort((a, b) => a.x - b.x)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const next = words[i + 1]
    const joined = next && Math.abs(next.y - w.y) < 14 ? `${w.s} ${next.s}` : null
    const pair = joined && BRANDS.find((b) => b === joined)
    const hit = pair || BRANDS.find((b) => b === w.s)
    if (hit) {
      cols.push({ brand: hit, x: w.x + w.w / 2 })
      if (pair) i++ // header split across two text items ("FLYING" "V")
    }
  }
  const overall = zone.find((i) => /^OVERALL/.test(i.s))
  const common = zone.find((i) => /^COMMON/.test(i.s))
  return { cols, productX: productHeader.x, overallX: overall ? overall.x : null, commonX: common ? common.x : null, headerY: bottom }
}

/**
 * Parse one page.
 * - Rows are the lines that contain a product label.
 * - Price cells are assigned to the brand column whose center is nearest (must be within a tolerance).
 * - Prices come in min/max pairs for a brand (single-price brands repeat the value).
 * - The row's own OVERALL RANGE (when present) must equal min/max of the parsed brand prices.
 */
export async function parsePage(page, ctx = {}) {
  const items = await pageItems(page)
  let header = findHeader(items)
  if ((!header || header.cols.length < 3) && ctx.fallback) header = ctx.fallback // continuation pages repeat no header
  if (!header || header.cols.length < 3) return { rows: [], skipped: 0, labels: [], note: 'no header' }

  const prodItems = items.filter((i) => PRODUCT_RE.test(i.s) && i.x < header.cols[0].x)
  if (!prodItems.length) return { rows: [], skipped: 0, labels: [], note: 'no products' }
  const pcol = prodItems[0].x
  const prodRows = prodItems.filter((p) => Math.abs(p.x - pcol) < 20).sort((a, b) => b.y - a.y)

  const rowH = median(prodRows.slice(1).map((p, i) => prodRows[i].y - p.y).filter((d) => d > 3 && d < 20)) || 9
  const gridLeft = prodRows[0].x + 25
  const overallStart = header.overallX != null ? header.overallX - 14 : Infinity
  const colGap = median(header.cols.slice(1).map((c, i) => c.x - header.cols[i].x)) || 40

  const rows = []
  let skipped = 0
  for (const p of prodRows) {
    const cells = items.filter((i) => Math.abs(i.y - p.y) <= rowH * 0.45 && i.x > gridLeft && i !== p)
    // The DOE layout interleaves price cells vertically: min/max for a product sits on the product line or
    // the line above. We read both lines and let the column geometry decide.
    const above = items.filter((i) => i.y > p.y + rowH * 0.45 && i.y <= p.y + rowH * 1.2 && i.x > gridLeft)
    void above
    const byBrand = new Map()
    const tokens = cells.filter((c) => c.x < overallStart && (isPrice(c.s) || /^\d{2,3}\.\d{2}\s*-\s*\d{2,3}\.\d{2}$/.test(c.s)))
    for (const t of tokens) {
      const cx = t.x + t.w / 2
      let best = null
      for (const c of header.cols) {
        const d = Math.abs(cx - c.x)
        if (!best || d < best.d) best = { c, d }
      }
      if (!best || best.d > colGap * 0.75) continue
      const vals = t.s.includes('-') ? t.s.split('-').map((v) => num(v.trim())) : [num(t.s)]
      const arr = byBrand.get(best.c.brand) ?? []
      arr.push(...vals)
      byBrand.set(best.c.brand, arr)
    }
    const brandPrices = [...byBrand.entries()].map(([brand, v]) => ({ brand, min: Math.min(...v), max: Math.max(...v) }))
    // Checksum: the OVERALL RANGE cells on the same line (everything between OVERALL and COMMON PRICE).
    const commonStart = header.commonX != null ? header.commonX - 12 : Infinity
    const rangeNums = cells.filter((c) => c.x >= overallStart && c.x < commonStart).flatMap((c) =>
      isPrice(c.s) ? [num(c.s)] : /^\d{2,3}\.\d{2}\s*-\s*\d{2,3}\.\d{2}$/.test(c.s) ? c.s.split('-').map((v) => num(v.trim())) : [],
    ).filter((v) => v > 0)
    let status = 'empty'
    if (brandPrices.length) {
      const lo = Math.min(...brandPrices.map((b) => b.min)), hi = Math.max(...brandPrices.map((b) => b.max))
      if (rangeNums.length >= 2) status = Math.abs(Math.min(...rangeNums) - lo) < 0.011 && Math.abs(Math.max(...rangeNums) - hi) < 0.011 ? 'ok' : 'mismatch'
      else status = 'unverified'
    } else if (rangeNums.length) status = 'mismatch' // range says there are prices, we found none
    rows.push({ y: p.y, product: p.s, brandPrices, status })
    if (status === 'mismatch') skipped++
  }
  return { rows, header, prodRows, rowH, skipped }
}

function median(a) {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

export async function openPdf(data) {
  return pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise
}

const HEADER_WORDS = /^(AREA|PROVINCE|CITY\/?|MUNICIPALITY|CITY \/|PRODUCT|COMMON|PRICE|RANGE|OVERALL)$|^(date of monitoring|date monitoring|note|prepared|submitted|verified|noted)/i

/**
 * Parse a whole report. Returns areas (one per 7-product block) whose rows all passed the checksum,
 * plus counters so callers can report coverage honestly.
 */
export async function parseDocument(doc) {
  const areas = []
  const stats = { rowsOk: 0, rowsDropped: 0, blocksNoLabel: 0, blocksAmbiguous: 0 }
  let lastHeader = null
  const seen = new Set()
  let weekText = ''
  const emitted = new Set()
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn)
    const items = await pageItems(page)
    if (pn <= 2 && !weekText) {
      const txt = items.map((i) => i.s).join(' ')
      const m = txt.match(/(?:week|period)[^()]{0,40}?(?:of|:)?\s*([A-Za-z]+\s*\d{1,2}\s*(?:-|to|–)\s*(?:[A-Za-z]+\s*)?\d{1,2}\s*,?\s*20\d\d)/i)
      if (m) weekText = m[1].replace(/\s+/g, ' ')
    }
    const r = await parsePage(page, { fallback: lastHeader })
    if (!r.header) continue
    lastHeader = r.header
    const { rows, header, rowH } = r
    // group into blocks starting at RON 100
    const blocks = []
    for (const row of rows) {
      if (row.product === 'RON 100' || !blocks.length) blocks.push([])
      blocks[blocks.length - 1].push(row)
    }
    const pcol = r.prodRows[0].x
    const blockSpan = (b) => ({ top: b[0].y + rowH * 0.7, bot: b[b.length - 1].y - rowH * 0.7 })
    const label = (i) => i.x < pcol - 4 && !HEADER_WORDS.test(i.s) && !PRODUCT_RE.test(i.s) && !/^(Republic|Department|Oil Industry|\(Kagawaran|DEPARTMENT)/i.test(i.s)
    const labels = items.filter(label)
    // x-clusters of label text: the right-most cluster is the city/municipality column, the left-most the province.
    const xs = []
    for (const l of [...labels].sort((p1, p2) => p1.x - p2.x)) {
      const c = xs.find((k) => Math.abs(k.x - l.x) < 28)
      if (c) c.items.push(l); else xs.push({ x: l.x, items: [l] })
    }
    // The city column is the one with the most labels.
    const cityX = [...xs].sort((p1, p2) => p2.items.length - p1.items.length)[0]
    const provX = xs.length > 1 ? xs.filter((k) => k !== cityX && k.x < cityX.x)[0] : null
    const join = (arr) => [...arr].sort((p1, p2) => p2.y - p1.y).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()
    // Province labels: group multi-line text (e.g. "Zamboanga del" / "Sur") that sits within ~1.6 rows.
    const provs = []
    if (provX) {
      for (const it of [...provX.items].sort((p1, p2) => p2.y - p1.y)) {
        const last = provs[provs.length - 1]
        if (last && last.minY - it.y < rowH * 1.6) { last.parts.push(it); last.minY = it.y } else provs.push({ parts: [it], maxY: it.y, minY: it.y })
      }
    }
    for (const b of blocks) {
      const { top, bot } = blockSpan(b)
      let mine = cityX ? cityX.items.filter((i) => i.y <= top && i.y >= bot) : []
      // Continuation pages repeat the previous page's last label above the first block. A block's own
      // label sits near its middle, so when several labels fall inside, keep only those in the middle band.
      if (mine.length > 1) {
        const mid = (top + bot) / 2
        const near = mine.filter((i) => Math.abs(i.y - mid) < rowH * 2.6)
        if (near.length) mine = near
      }
      // Overlapping duplicate labels: the PDF re-prints the previous page's last label on top of the next
      // block's own label. A label we've already emitted is the stale one, so drop it when something new remains.
      if (mine.length > 1) {
        const fresh = mine.filter((i) => !emitted.has(i.s))
        if (fresh.length && fresh.length < mine.length) mine = fresh
      }
      if (!mine.length) { stats.blocksNoLabel++; continue }
      // group multi-line city names ("Dasmariñas" / "City")
      const name = join(mine)
      // nearest province label to the block's middle
      const mid = (top + bot) / 2
      const prov = provs.length ? [...provs].sort((p1, p2) => Math.abs((p1.maxY + p1.minY) / 2 - mid) - Math.abs((p2.maxY + p2.minY) / 2 - mid))[0] : null
      // A province is accepted only if it reads like a place name (letters only) - never boilerplate such as
      // "DATE MONITORING:" that sits in the same column.
      const provText = prov ? join(prov.parts) : ''
      const province = /^[A-Za-zÑñ. -]{3,40}$/.test(provText) && !/monitor|date|note|prepared/i.test(provText) ? provText : ''
      const good = b.filter((x) => x.status === 'ok')
      stats.rowsOk += good.length
      stats.rowsDropped += b.length - good.length - b.filter((x) => x.status === 'empty').length
      emitted.add(name)
      areas.push({ name, province, prices: Object.fromEntries(good.map((x) => [x.product, Object.fromEntries(x.brandPrices.map((p) => [p.brand, [p.min, p.max]]))])) })
    }
  }
  return { areas, stats, weekText }
}
