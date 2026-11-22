const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** "November 10-16, 2026", "OCTOBER 27-NOVEMBER 02, 2026", "Nov 3 - Nov 9 2026" -> { start, end } | null */
export function parseWeek(text) {
  const t = (text ?? '').toLowerCase().replace(/[–—]/g, '-')
  const m = t.match(/([a-z]+)\s*(\d{1,2})\s*(?:-|to)\s*(?:([a-z]+)\s*)?(\d{1,2})\s*,?\s*(20\d\d)/)
  if (!m) return null
  const mi = (s) => MONTHS.findIndex((x) => x.startsWith(s.slice(0, 3)))
  const m1 = mi(m[1])
  const m2 = m[3] ? mi(m[3]) : m1
  if (m1 < 0 || m2 < 0) return null
  const y = Number(m[5])
  return { start: iso(y, m1, Number(m[2])), end: iso(m2 < m1 ? y + 1 : y, m2, Number(m[4])) }
}
