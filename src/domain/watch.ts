// Price watch rules: when a watched product counts as "cheaper now", and which
// leaflet offers are about it. Kept free of React so the tests and the
// background runner (public/runners/background.js, same rules) agree.

/** Did the watched product reach what the user waits for? */
export function watchHit(current: number | null | undefined, w: { baselineCents: number | null; targetCents?: number | null }, ref?: number | null): boolean {
  if (current == null) return false
  if (w.targetCents != null) return current <= w.targetCents && (ref == null || current < ref)
  const base = ref ?? w.baselineCents
  return base != null && current < base
}

// Words that say nothing about which product it is.
const STOP = new Set([
  'ja', 'tai', 'sekä', 'eri', 'lajit', 'lajitelma', 'kpl', 'pkt', 'rs', 'prk', 'pss', 'tlk', 'plo', 'kg', 'g', 'ml', 'cl', 'dl', 'l',
  'och', 'med', 'utan', 'the', 'and', 'with', 'uusi', 'new', 'ny', 'koot', 'koko', 'size', 'sorts', 'sort', 'laatu', 'tuote', 'tuotteet',
  'miesten', 'naisten', 'lasten', 'erilaisia', 'erilainen', 'valittavana', 'kaikki', 'useita', 'lidl', 'plus', 'tarjous', 'hinta', 'norm', 'esim', 'alk', 'alkaen', 'from', 'från', 'vain', 'only', 'max', 'per', 'talous', 'perhe',
])
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** The words of a name that tell products apart ("Atria Kanan sisäfilee 400 g" → atria, kanan, sisafilee). */
export function nameWords(name: string): string[] {
  return [...new Set(fold(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d/.test(w) && !STOP.has(w)))]
}

const same = (a: string, b: string) => {
  if (a === b) return true
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  // "sisafilee" ~ "sisafileet", "jauheliha" in "nautajauheliha"
  return s.length >= 5 && (l.startsWith(s) || l.endsWith(s) || (s.length >= 6 && l.includes(s)))
}

/**
 * Is this leaflet offer about the product? The brand must be in the offer
 * (Puhdistamo, Oral-B, Atria…) plus another word of the product, and most of
 * the offer's words must fit. Without a known brand it takes three words, so
 * a plain "Deodorantti roll-on" or "Jauheliha" offer is not taken for one
 * particular product.
 */
export function offerIsFor(product: { name: string; brand?: string }, offerName: string, words = nameWords(product.name)): boolean {
  const ow = nameWords(offerName)
  if (ow.length < 2 || words.length < 2) return false
  const hit = ow.filter((o) => words.some((p) => same(o, p)))
  if (hit.length / ow.length < 0.6) return false
  const brand = nameWords(product.brand ?? '')
  if (!brand.length) return hit.length >= 3
  const isBrand = (w: string) => brand.some((b) => same(w, b))
  if (!hit.some(isBrand)) return false
  // Beyond the brand, most of what the offer names must be this product too
  // ("Karl Fazer Makukonvehdit" is not every Karl Fazer bar).
  const rest = ow.filter((o) => !isBrand(o))
  const restHit = hit.filter((h) => !isBrand(h))
  return restHit.length >= 1 && restHit.length / Math.max(1, rest.length) >= 0.6
}
