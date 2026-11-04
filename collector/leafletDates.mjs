// Validity dates printed in leaflets: "voimassa ke–su 16.–27.9.2026", "vko 45/2026", "Week 45-46", "DM 2645".
const iso = (d) => d.toISOString().slice(0, 10)

/** Monday–Sunday of an ISO week. */
export function weekRange(week, year) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const mon = new Date(jan4); mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7)
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
  return [iso(mon), iso(sun)]
}
/** "voimassa ke–su 16.–27.9.2026", "vko 45/2026", "Week 45-46", "DM 2645" → [from, until] */
export function datesFrom(text, year = new Date().getUTCFullYear()) {
  let m = text.match(/(\d{1,2})\.\s?(?:(\d{1,2})\.)?\s?[–-]\s?(\d{1,2})\.(\d{1,2})\.(20\d\d)?/)
  if (m) {
    const y = +(m[5] || year), endM = +m[4], startM = +(m[2] || endM)
    return [`${y}-${String(startM).padStart(2, '0')}-${m[1].padStart(2, '0')}`, `${y}-${String(endM).padStart(2, '0')}-${m[3].padStart(2, '0')}`]
  }
  m = text.match(/(?:vko|vk|viikko|week)\.?\s?(\d{1,2})(?:\s?[–-]\s?(\d{1,2}))?(?:\s?\/\s?(20\d\d))?/i) || text.match(/\b\w{2}\s?(2\d)(\d{2})\b/)
  if (m) {
    let a, b, y
    if (m[0].match(/^\w{2}\s?2\d\d\d$/)) { y = 2000 + +m[1]; a = b = +m[2] } else { a = +m[1]; b = +(m[2] || m[1]); y = +(m[3] || year) }
    if (a >= 1 && a <= 53) return [weekRange(a, y)[0], weekRange(Math.max(a, b), y)[1]]
  }
  return [null, null]
}

