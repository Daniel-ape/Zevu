// Open Food Facts connector — product information only (never prices).
// Free, open database (ODbL licence); the API allows browser requests (CORS).
// https://openfoodfacts.github.io/openfoodfacts-server/api/

import type { CategoryId, Product, SizeUnit } from '../domain/types'
import type { Lang } from '../i18n'

const BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_fi,product_name_sv,product_name_en,brands,quantity,categories_tags,image_front_small_url'
// OFF asks apps to identify themselves.
const HEADERS = { 'User-Agent': 'Hintaopas/0.1 (grocery price comparison, Finland)' }

export interface OffProduct {
  code?: string
  product_name?: string
  product_name_fi?: string
  product_name_sv?: string
  product_name_en?: string
  brands?: string
  quantity?: string
  categories_tags?: string[]
  image_front_small_url?: string
}

/** Thrown when the service can't be reached (offline, blocked, server error). */
export class OffUnavailable extends Error {}

async function getJson(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal })
    if (!res.ok && res.status !== 404) throw new OffUnavailable(`HTTP ${res.status}`)
    return res.status === 404 ? null : await res.json()
  } catch (e) {
    if (e instanceof OffUnavailable) throw e
    throw new OffUnavailable(String(e))
  } finally {
    clearTimeout(timer)
  }
}

export function parseQuantity(q?: string): { amount: number; unit: SizeUnit } {
  const s = (q ?? '').toLowerCase().replace(',', '.')
  const multi = s.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|l|dl|cl|ml)\b/)
  const one = s.replace(/\b(grams?|gr)\b/, 'g').match(/(\d+(?:\.\d+)?)\s*(kg|g|l|dl|cl|ml|kpl|pcs|st)\b/)
  const toBase = (n: number, u: string): { amount: number; unit: SizeUnit } => {
    switch (u) {
      case 'kg': return { amount: n * 1000, unit: 'g' }
      case 'g': return { amount: n, unit: 'g' }
      case 'l': return { amount: n * 1000, unit: 'ml' }
      case 'dl': return { amount: n * 100, unit: 'ml' }
      case 'cl': return { amount: n * 10, unit: 'ml' }
      case 'ml': return { amount: n, unit: 'ml' }
      default: return { amount: n, unit: 'pcs' }
    }
  }
  if (multi) {
    const b = toBase(parseFloat(multi[2]), multi[3])
    return { amount: Math.round(b.amount * +multi[1]), unit: b.unit }
  }
  if (one) {
    const b = toBase(parseFloat(one[1]), one[2])
    return { amount: Math.round(b.amount), unit: b.unit }
  }
  return { amount: 1, unit: 'pcs' }
}

// Checked in order; the first match wins. Broad umbrella tags are removed first
// ("plant-based-foods-and-beverages" would otherwise make everything a drink).
const CATEGORY_RULES: Array<[RegExp, CategoryId, string]> = [
  [/(sauces|condiments|pastas|rices|flours|cereals|breakfast|spreads|canned|soups|spices|oils|sugars|jams|honeys)/, 'pantry', '🥫'],
  [/(milks|dairies|yogurts|cheeses|eggs|butters|creams|quarks)/, 'dairy', '🥛'],
  [/(breads|crispbreads|rusks|pastries|buns)/, 'bread', '🍞'],
  [/(meats|sausages|hams|poultry|fishes|seafood|chicken)/, 'meat', '🥩'],
  [/(beverages|drinks|juices|coffees|teas|waters|sodas)/, 'drinks', '🧃'],
  [/(snacks|sweets|chocolates|candies|biscuits|confectioneries|chips|desserts|ice-creams)/, 'snacks', '🍫'],
  [/(fresh-fruits|fresh-vegetables|fruits|vegetables|potatoes|berries|salads)/, 'produce', '🥬'],
  [/(cleaning|detergents|household|hygiene)/, 'household', '🧴'],
]
const UMBRELLA = /^en:(plant-based-foods-and-beverages|plant-based-foods|cereals-and-potatoes|fruits-and-vegetables-based-foods|beverages-and-beverages-preparations|foods|groceries)$/

function category(tags: string[] = []): { category: CategoryId; emoji: string } {
  const joined = tags.filter((t) => !UMBRELLA.test(t)).join(' ')
  for (const [re, category, emoji] of CATEGORY_RULES) if (re.test(joined)) return { category, emoji }
  return { category: 'pantry', emoji: '🛒' }
}

export function toProduct(p: OffProduct, lang: Lang): Product | null {
  const name =
    (lang === 'sv' && p.product_name_sv) || (lang === 'en' && p.product_name_en) ||
    p.product_name_fi || p.product_name || p.product_name_sv || p.product_name_en
  if (!p.code || !name?.trim()) return null
  const { category: cat, emoji } = category(p.categories_tags)
  return {
    id: `off:${p.code}`,
    ean: p.code,
    name: name.trim(),
    brand: (p.brands ?? '').split(',')[0].trim(),
    category: cat,
    size: parseQuantity(p.quantity),
    emoji,
    imageUrl: p.image_front_small_url,
    infoSource: 'open-food-facts',
  }
}

/** Product by barcode; null when Open Food Facts doesn't know it. */
export async function lookupBarcode(ean: string, lang: Lang): Promise<Product | null> {
  const json = await getJson(`${BASE}/api/v2/product/${encodeURIComponent(ean)}.json?fields=${FIELDS}`)
  if (!json || json.status !== 1 || !json.product) return null
  return toProduct({ code: ean, ...json.product }, lang)
}

/** Text search limited to products sold in Finland. */
export async function searchProducts(query: string, lang: Lang): Promise<Product[]> {
  const params = new URLSearchParams({
    search_terms: query, search_simple: '1', json: '1', page_size: '20',
    tagtype_0: 'countries', tag_contains_0: 'contains', tag_0: 'finland', fields: FIELDS,
  })
  const json = await getJson(`${BASE}/cgi/search.pl?${params}`)
  return ((json?.products ?? []) as OffProduct[]).map((p) => toProduct(p, lang)).filter((p): p is Product => !!p)
}
