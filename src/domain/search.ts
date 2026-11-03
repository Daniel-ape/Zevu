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
function wordScore(q: string, words: string[], joined: string, named?: Set<string>) {
  if (/^\d{4,}$/.test(q)) return joined.includes(q) ? 3 : 0
  let best = 0
  for (const w of words) {
    // A word found only in the brand is a weaker match than one in the name.
    if (w === q) { if (!named || named.has(w)) return 4; best = Math.max(best, 2.5); continue }
    if (w.startsWith(q)) best = Math.max(best, 3)
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 2)
    else if (q.length >= 4) {
      const max = q.length >= 7 ? 2 : 1
      // Compare with the start of the word too, so "maitt" finds "maitojuoma".
      if (distance(q, w, max) <= max || distance(q, w.slice(0, q.length), max) <= max) best = Math.max(best, 1)
    }
  }
  return best
}

export type Haystack = { words: string[]; joined: string; named: Set<string> }
export const haystack = (p: Product): Haystack => {
  const joined = fold(`${p.name} ${p.altName ?? ''} ${p.brand} ${p.ean}`)
  return { words: joined.split(' '), joined, named: new Set(fold(`${p.name} ${p.altName ?? ''}`).split(' ')) }
}

/** 0 when the product doesn't match, higher is a better match. */
export function matchScore(query: string, h: Haystack): number {
  const terms = fold(query).split(' ').filter(Boolean)
  if (!terms.length) return 1
  let total = 0
  for (const t of terms) {
    let s = wordScore(t, h.words, h.joined, h.named)
    for (const alt of WORDS[t] ?? []) {
      const a = fold(alt)
      s = Math.max(s, a.includes(' ') ? (h.joined.includes(a) ? 3 : 0) : Math.min(3.5, wordScore(a, h.words, h.joined, h.named)))
    }
    if (!s) return 0
    total += s
  }
  return total / terms.length
}
