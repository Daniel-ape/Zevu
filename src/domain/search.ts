import type { Product } from './types'

// Forgiving product search:
// - ignores case and dots/rings (maito = maitö, ost = öst)
// - understands common Swedish and English grocery words (mjölk -> maito)
// - tolerates a typo or two in longer words (maitto -> maito)
// Every word of the query must match something in the product's names, brand
// or barcode. Better matches sort first.

export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim()

// Swedish / English word -> Finnish words used in product names.
const WORDS: Record<string, string[]> = {
  mjolk: ['maito'], milk: ['maito'], smor: ['voi'], butter: ['voi'], ost: ['juusto'], cheese: ['juusto'],
  brod: ['leipa', 'leivat'], bread: ['leipa'], agg: ['kananmuna', 'muna'], egg: ['kananmuna', 'muna'], eggs: ['kananmuna', 'muna'],
  kaffe: ['kahvi'], coffee: ['kahvi'], te: ['tee'], tea: ['tee'], yoghurt: ['jogurtti'], yogurt: ['jogurtti'], jogurt: ['jogurtti'],
  gradde: ['kerma'], cream: ['kerma'], fil: ['viili'], filmjolk: ['piima', 'viili'], kvarg: ['rahka'], kesella: ['rahka'],
  kottfars: ['jauheliha'], mince: ['jauheliha'], kyckling: ['kana', 'broileri'], chicken: ['kana', 'broileri'],
  korv: ['makkara', 'nakki'], sausage: ['makkara', 'nakki'], fisk: ['kala'], fish: ['kala'], lax: ['lohi'], salmon: ['lohi'],
  skinka: ['kinkku'], ham: ['kinkku'], bacon: ['pekoni'], potatis: ['peruna'], potato: ['peruna'], potatoes: ['peruna'],
  tomat: ['tomaatti'], tomato: ['tomaatti'], gurka: ['kurkku'], cucumber: ['kurkku'], lok: ['sipuli'], onion: ['sipuli'],
  morot: ['porkkana'], morotter: ['porkkana'], carrot: ['porkkana'], banan: ['banaani'], banana: ['banaani'],
  apple: ['omena'], appel: ['omena'], apelsin: ['appelsiini'], orange: ['appelsiini'], citron: ['sitruuna'], lemon: ['sitruuna'],
  ris: ['riisi'], rice: ['riisi'], makaroner: ['makaroni'], spaghetti: ['spagetti'], socker: ['sokeri'], sugar: ['sokeri'],
  mjol: ['jauho', 'vehnajauho'], flour: ['jauho'], havregryn: ['kaurahiutale'], oats: ['kaura'], havre: ['kaura'],
  juice: ['mehu'], saft: ['mehu'], lask: ['virvoitusjuoma', 'limsa'], vatten: ['vesi'], water: ['vesi'], ol: ['olut'], beer: ['olut'],
  chips: ['sipsi', 'sipsit', 'perunalastu'], choklad: ['suklaa'], chocolate: ['suklaa'], godis: ['makeinen', 'karkki'], candy: ['karkki', 'makeinen'],
  glass: ['jaatelo'], icecream: ['jaatelo'], kex: ['keksi'], biscuit: ['keksi'], flingor: ['muro', 'murot'], cereal: ['muro'],
  majonnas: ['majoneesi'], senap: ['sinappi'], mustard: ['sinappi'], olja: ['oljy'], oil: ['oljy'], salt: ['suola'],
  peppar: ['pippuri'], pepper: ['pippuri'], tvattmedel: ['pyykinpesu', 'pesuaine'], diskmedel: ['astianpesu'],
  toalettpapper: ['wc paperi', 'wc-paperi'], hushallspapper: ['talouspaperi'], pizza: ['pizza'], soppa: ['keitto'], soup: ['keitto'],
  sylt: ['hillo'], jam: ['hillo'], honung: ['hunaja'], honey: ['hunaja'], nudlar: ['nuudeli'], noodles: ['nuudeli'],
  bar: ['marja'], berries: ['marja'], blabar: ['mustikka'], blueberry: ['mustikka'], jordgubbe: ['mansikka'], strawberry: ['mansikka'],
  lingon: ['puolukka'], frukt: ['hedelma'], fruit: ['hedelma'], gronsaker: ['vihannes'], sallad: ['salaatti'], salad: ['salaatti'],
  havredryck: ['kaurajuoma'], laktosfri: ['laktoositon'], lactosefree: ['laktoositon'], fryst: ['pakaste'], frozen: ['pakaste'],
}

function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

// How well one query word matches the product's words (0 = no match).
// The first `named` words come from the product's names, the rest from the
// brand and barcode.
function wordScore(q: string, words: string[], joined: string, named: number, fuzzy = true) {
  if (/^\d{4,}$/.test(q)) return joined.includes(q) ? 3 : 0
  let best = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    // A word found only in the brand is a weaker match than one in the name.
    if (w === q) { if (i < named) return 4; best = Math.max(best, 2.5); continue }
    // Finnish compounds name the thing last: "kevytmaito" is milk, "maitosuklaa"
    // is chocolate. A query at the end of a word is a strong match, a whole
    // word at the start of a longer compound a weaker one.
    if (q.length >= 4 && w.endsWith(q)) best = Math.max(best, i < named ? 3.6 : 2.5)
    else if (w.startsWith(q)) best = Math.max(best, q.length >= 4 && w.length - q.length >= 4 ? 2.6 : 3)
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 2)
    else if (fuzzy && q.length >= 4) {
      // Typos rarely hit both of the first two letters: skip the rest early.
      if (w[0] !== q[0] && w[1] !== q[1]) continue
      const max = q.length >= 7 ? 2 : 1
      // Compare with the start of the word too, so "maitt" finds "maitojuoma".
      if (distance(q, w, max) <= max || distance(q, w.slice(0, q.length), max) <= max) best = Math.max(best, 1)
    }
  }
  return best
}

// Kept small on purpose: one string and a count per product. With 200 000
// products, a list of words and a set per product used well over 100 MB,
// enough for the phone to close the app; the words are split out only for
// products that pass the quick text test.
export type Haystack = { joined: string; named: number }
export const haystack = (p: Product): Haystack => {
  const name = fold(`${p.name} ${p.altName ?? ''}`)
  const rest = fold(`${p.brand} ${p.ean}`)
  let named = name ? 1 : 0
  for (let i = 0; i < name.length; i++) if (name.charCodeAt(i) === 32) named++
  return { joined: name && rest ? name + ' ' + rest : name || rest, named }
}

// One shared set of search texts per product list, made as products are first searched.
const hayCache = new WeakMap<object, Map<string, Haystack>>()
export function hayFor(products: readonly Product[]) {
  let m = hayCache.get(products)
  if (!m) { m = new Map(); hayCache.set(products, m) }
  const map = m
  return { get: (p: Product) => { let v = map.get(p.id); if (!v) { v = haystack(p); map.set(p.id, v) } return v }, m: map }
}

/** A query prepared once, so scoring thousands of products stays cheap while typing. */
export type Query = { term: string; alts: string[] }[]
export function compileQuery(query: string): Query {
  return fold(query).split(' ').filter(Boolean).map((term) => ({ term, alts: (WORDS[term] ?? []).map(fold) }))
}

/**
 * 0 when the product doesn't match, higher is a better match. Without
 * `fuzzy`, typos are not forgiven (much faster; used first, then again with
 * typos only when few products match).
 */
export function matchScore(query: string | Query, h: Haystack, fuzzy = true): number {
  const terms = typeof query === 'string' ? compileQuery(query) : query
  if (!terms.length) return 1
  let total = 0
  // Without typos every match is a piece of the product's text, so one quick
  // substring test rules out almost all products before the word-by-word scoring.
  if (!fuzzy) for (const { term, alts } of terms) if (!h.joined.includes(term) && !alts.some((a) => h.joined.includes(a))) return 0
  const words = h.joined.split(' ')
  for (const { term, alts } of terms) {
    let s = wordScore(term, words, h.joined, h.named, fuzzy)
    for (const a of alts) {
      if (s >= 3.5) break
      s = Math.max(s, a.includes(' ') ? (h.joined.includes(a) ? 3 : 0) : Math.min(3.5, wordScore(a, words, h.joined, h.named, fuzzy)))
    }
    if (!s) return 0
    total += s
  }
  return total / terms.length
}
