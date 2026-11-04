// Coupons the user saves: a clipped paper coupon or a members' offer from a
// leaflet, photographed and read on the phone. Nothing is fetched from the shops.
export interface Coupon {
  id: string
  chain: string // CARD_CHAINS id ('other' when unknown)
  title: string
  priceCents: number | null // offer price, if the coupon has one
  percent: number | null // "-30 %"
  validUntil: string | null // YYYY-MM-DD
  image?: string // small JPEG data URL
  used?: boolean
  added: string
}

const CHAIN_WORDS: [RegExp, string][] = [
  [/plussa|k-?\s?(city)?market|k-?\s?super|k-ruoka|\bk-kauppa/i, 'k'],
  [/s-?\s?etukort|s-?\s?etu\b|bonus|prisma|s-?\s?market|\bsale\b|alepa|osuuskauppa/i, 's'],
  [/lidl/i, 'lidl'],
  [/tokmanni|tokmanni club|\bclub\b/i, 'tokmanni'],
  [/halpa-?\s?halli/i, 'halpahalli'],
  [/minimani/i, 'minimani'],
  [/rusta/i, 'rusta'],
  [/k[aä]rkk[aä]inen/i, 'karkkainen'],
]

const pad = (n: number) => String(n).padStart(2, '0')

/** The last date in the text ("voimassa 4.–10.11.", "asti 30.11.2026", "giltig t.o.m. 8.11."). */
function lastDate(text: string, now: Date): string | null {
  const out: Date[] = []
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/g)) {
    const d = +m[1], mo = +m[2]
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue
    let y = m[3] ? +m[3] : now.getFullYear()
    if (y < 100) y += 2000
    let date = new Date(y, mo - 1, d)
    if (!m[3] && date.getTime() < now.getTime() - 60 * 86_400_000) date = new Date(y + 1, mo - 1, d) // early next year
    out.push(date)
  }
  if (!out.length) return null
  const last = out.sort((a, b) => b.getTime() - a.getTime())[0]
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`
}

/** Best guess of a coupon's details from the text read off its photo; the user checks it. */
export function parseCoupon(text: string, now = new Date()): Omit<Coupon, 'id' | 'added' | 'image'> {
  const lines = text.split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 1)
  const chain = CHAIN_WORDS.find(([re]) => re.test(text))?.[1] ?? 'other'
  const pct = text.match(/-?\s?(\d{1,2})\s?%/)
  // Prices: "2,99", "2.99 €", or big split prices "2 99"; the offer is usually the biggest number on the coupon that isn't a unit price.
  const prices = [...text.matchAll(/(\d{1,3})[,.](\d{2})(?!\s*(€|e)?\s*\/\s*(kg|l|kpl))/gi)].map((m) => +m[1] * 100 + +m[2]).filter((c) => c > 0 && c < 100000)
  const priceCents = prices.length ? prices[0] : null
  // Title: the longest line with letters that isn't boilerplate.
  const boring = /voimassa|giltig|asti|t\.o\.m|kuponki|kupong|etu|plussa|bonus|leikkaa|klipp|norm|ovh|jäsen|medlem|kassa|€|%|\d{2}\.\d{1,2}\./i
  const title = lines
    .filter((l) => /[a-zåäö]{3}/i.test(l) && !boring.test(l))
    .sort((a, b) => b.length - a.length)[0]?.slice(0, 80) ?? ''
  return { chain, title, priceCents, percent: pct ? +pct[1] : null, validUntil: lastDate(text, now) }
}

/** Expired coupons are kept for a day so the user sees what went, then hidden. */
export function isActive(c: Coupon, now = new Date()) {
  if (!c.validUntil) return true
  return new Date(c.validUntil + 'T23:59:59').getTime() >= now.getTime()
}
