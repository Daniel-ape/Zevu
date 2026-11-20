// Opening hours as OpenStreetMap writes them ("Mo-Fr 07:00-21:00; Sa,Su
// 09:00-18:00", "24/7"), read just far enough to say whether a shop is open
// now and until when. Holiday and date rules ("PH off", "Dec 24 …") are left
// out: on those days the answer may be off, so the app words it plainly.

const DAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']
/** Minutes from Monday 00:00 of each opening span, per weekday (0 = Monday). */
export type Week = [number, number][][]

export function parseHours(spec: string | undefined): Week | 'always' | null {
  if (!spec) return null
  const s = spec.trim().toLowerCase()
  if (s === '24/7' || s === 'mo-su 00:00-24:00') return 'always'
  const week: Week = DAYS.map(() => [])
  let any = false
  // rules are split by ";" (and sometimes "," between whole rules: "Mo-Fr 8-21, Sa 9-18")
  const rules = s.split(/;|(?<=\d),\s*(?=(?:mo|tu|we|th|fr|sa|su)\b)/)
  for (const raw of rules) {
    const rule = raw.trim()
    if (!rule) continue
    const m = rule.match(/^((?:(?:mo|tu|we|th|fr|sa|su)(?:\s*-\s*(?:mo|tu|we|th|fr|sa|su))?\s*,?\s*)+)\s+(.+)$/)
    // a rule with no weekdays ("07:00-21:00") is every day; holiday or date rules are skipped
    const days = m ? daysOf(m[1]) : /^\d/.test(rule) ? [0, 1, 2, 3, 4, 5, 6] : null
    const times = m ? m[2] : rule
    if (!days) continue
    if (/^(off|closed)\b/.test(times)) { for (const d of days) week[d] = []; any = true; continue }
    const spans: [number, number][] = []
    for (const t of times.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)) {
      const a = +t[1] * 60 + +t[2]
      let b = +t[3] * 60 + +t[4]
      if (b <= a) b += 1440 // past midnight
      spans.push([a, b])
    }
    if (!spans.length) continue
    for (const d of days) week[d] = spans // a later rule replaces an earlier one for its days
    any = true
  }
  return any ? week : null
}

function daysOf(spec: string): number[] {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const [a, b] = part.trim().split(/\s*-\s*/).map((d) => DAYS.indexOf(d.trim()))
    if (a < 0) continue
    if (b === undefined || b < 0) { out.add(a); continue }
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break }
  }
  return [...out]
}

export type OpenStatus =
  | { open: true; always?: boolean; until?: number } // minutes after midnight (may be ≥ 1440)
  | { open: false; opensIn?: number; at?: number } // opensIn: days from today (0 = today), at: minutes

export function openStatus(week: Week | 'always' | null, now = new Date()): OpenStatus | null {
  if (!week) return null
  if (week === 'always') return { open: true, always: true }
  const d = (now.getDay() + 6) % 7
  const m = now.getHours() * 60 + now.getMinutes()
  for (const [a, b] of week[d]) if (m >= a && m < b) return { open: true, until: b }
  // still open from last night ("22:00-02:00")
  for (const [a, b] of week[(d + 6) % 7]) if (b > 1440 && m + 1440 >= a && m + 1440 < b) return { open: true, until: b - 1440 }
  for (let k = 0; k < 7; k++) {
    const spans = week[(d + k) % 7].filter(([a]) => k > 0 || a > m).sort((x, y) => x[0] - y[0])
    if (spans.length) return { open: false, opensIn: k, at: spans[0][0] }
  }
  return { open: false }
}

/** "21" or "21.30" (Finnish and Swedish way of writing a time). */
export const clock = (min: number) => {
  const h = Math.floor(min / 60) % 24, m = min % 60
  return m ? `${h}.${String(m).padStart(2, '0')}` : String(h === 0 && min >= 1440 ? 24 : h)
}
