// SAMPLE DATA — NOT REAL RETAILER PRICES.
// This provider exists only so the interface can be built and tested before
// real price connectors are in place. Every observation it returns carries
// source: 'sample', and the UI labels these prices as examples.

import type { LoyaltyProgram, PriceObservation, PriceProvider, Product, Retailer } from '../domain/types'

export const RETAILERS: Retailer[] = [
  { id: 'prisma', name: 'Prisma', chain: 's-group' },
  { id: 's-market', name: 'S-market', chain: 's-group' },
  { id: 'k-citymarket', name: 'K-Citymarket', chain: 'k-group' },
  { id: 'k-market', name: 'K-Market', chain: 'k-group' },
  { id: 'k-supermarket', name: 'K-Supermarket', chain: 'k-group' },
  { id: 'sale', name: 'Sale', chain: 's-group' },
  { id: 'alepa', name: 'Alepa', chain: 's-group' },
  { id: 'lidl', name: 'Lidl', chain: 'lidl' },
  { id: 'tokmanni', name: 'Tokmanni', chain: 'tokmanni' },
]

export const LOYALTY_PROGRAMS: LoyaltyProgram[] = [
  { chain: 's-group', name: 'S-Etukortti', stores: 'Prisma, S-market, Sale, Alepa' },
  { chain: 'k-group', name: 'K-Plussa', stores: 'K-Citymarket, K-Supermarket, K-Market' },
  { chain: 'lidl', name: 'Lidl Plus', stores: 'Lidl' },
  { chain: 'tokmanni', name: 'Tokmanni Club', stores: 'Tokmanni' },
]

// EANs here are placeholders in the sample range, not real product codes.
export const PRODUCTS: Product[] = [
  { id: 'p1', ean: '2000000000015', name: 'Skimmed milk', brand: 'Sample Dairy', category: 'dairy', size: { amount: 1000, unit: 'ml' }, emoji: '🥛' },
  { id: 'p2', ean: '2000000000022', name: 'Lactose-free milk drink 1.5%', brand: 'Sample Dairy', category: 'dairy', size: { amount: 1000, unit: 'ml' }, emoji: '🥛' },
  { id: 'p3', ean: '2000000000039', name: 'Edam cheese slices', brand: 'Sample Dairy', category: 'dairy', size: { amount: 300, unit: 'g' }, emoji: '🧀' },
  { id: 'p4', ean: '2000000000046', name: 'Natural yoghurt', brand: 'Sample Dairy', category: 'dairy', size: { amount: 1000, unit: 'g' }, emoji: '🥣' },
  { id: 'p5', ean: '2000000000053', name: 'Rye bread, sliced', brand: 'Sample Bakery', category: 'bread', size: { amount: 500, unit: 'g' }, emoji: '🍞' },
  { id: 'p6', ean: '2000000000060', name: 'Oat flakes', brand: 'Sample Mills', category: 'pantry', size: { amount: 1000, unit: 'g' }, emoji: '🌾' },
  { id: 'p7', ean: '2000000000077', name: 'Bananas', brand: 'Loose', category: 'produce', size: { amount: 1000, unit: 'g' }, emoji: '🍌' },
  { id: 'p8', ean: '2000000000084', name: 'Cucumber', brand: 'Finnish grown', category: 'produce', size: { amount: 1, unit: 'pcs' }, emoji: '🥒' },
  { id: 'p9', ean: '2000000000091', name: 'Potatoes, yellow', brand: 'Finnish grown', category: 'produce', size: { amount: 2000, unit: 'g' }, emoji: '🥔' },
  { id: 'p10', ean: '2000000000107', name: 'Minced beef 10%', brand: 'Sample Meats', category: 'meat', size: { amount: 400, unit: 'g' }, emoji: '🥩' },
  { id: 'p11', ean: '2000000000114', name: 'Chicken fillet strips', brand: 'Sample Meats', category: 'meat', size: { amount: 450, unit: 'g' }, emoji: '🍗' },
  { id: 'p12', ean: '2000000000121', name: 'Coffee, medium roast', brand: 'Sample Roastery', category: 'drinks', size: { amount: 500, unit: 'g' }, emoji: '☕' },
  { id: 'p13', ean: '2000000000138', name: 'Orange juice', brand: 'Sample Drinks', category: 'drinks', size: { amount: 1000, unit: 'ml' }, emoji: '🧃' },
  { id: 'p14', ean: '2000000000145', name: 'Spaghetti', brand: 'Sample Pasta', category: 'pantry', size: { amount: 1000, unit: 'g' }, emoji: '🍝' },
  { id: 'p15', ean: '2000000000152', name: 'Milk chocolate bar', brand: 'Sample Sweets', category: 'snacks', size: { amount: 200, unit: 'g' }, emoji: '🍫' },
  { id: 'p16', ean: '2000000000169', name: 'Dish soap', brand: 'Sample Home', category: 'household', size: { amount: 500, unit: 'ml' }, emoji: '🧴' },
  { id: 'p17', ean: '2000000000176', name: 'Eggs, free range 10 pcs', brand: 'Sample Farm', category: 'dairy', size: { amount: 10, unit: 'pcs' }, emoji: '🥚' },
  { id: 'p18', ean: '2000000000183', name: 'Butter, salted', brand: 'Sample Dairy', category: 'dairy', size: { amount: 500, unit: 'g' }, emoji: '🧈' },
]

// Base price in cents per product; each retailer applies a factor plus noise.
const BASE: Record<string, number> = {
  p1: 99, p2: 189, p3: 349, p4: 229, p5: 219, p6: 145, p7: 199, p8: 119, p9: 249,
  p10: 489, p11: 599, p12: 699, p13: 259, p14: 169, p15: 299, p16: 249, p17: 329, p18: 449,
}
// Stores without sample prices only get prices from imported receipts.
const SAMPLE_STORES = ['prisma', 's-market', 'k-citymarket', 'k-market', 'lidl', 'tokmanni']
const FACTOR: Record<string, number> = {
  prisma: 1.0, 's-market': 1.06, 'k-citymarket': 1.01, 'k-market': 1.12, lidl: 0.93, tokmanni: 0.97,
}
// Not every store carries everything; missing combinations simply have no observations.
const NOT_CARRIED: Record<string, string[]> = {
  lidl: ['p2', 'p16'],
  tokmanni: ['p7', 'p8', 'p9', 'p10', 'p11', 'p4'],
}
// A few deliberately stale observations to exercise the "outdated" state.
const STALE: Array<[string, string]> = [['k-market', 'p12'], ['tokmanni', 'p3'], ['s-market', 'p10']]

function rand(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

const WEEKS = 12
const DAY = 86_400_000

function generate(now: number): PriceObservation[] {
  const out: PriceObservation[] = []
  for (const r of RETAILERS.filter((x) => SAMPLE_STORES.includes(x.id))) {
    for (const p of PRODUCTS) {
      if (NOT_CARRIED[r.id]?.includes(p.id)) continue
      const stale = STALE.some(([rid, pid]) => rid === r.id && pid === p.id)
      for (let w = WEEKS - 1; w >= 0; w--) {
        // slow drift over time + small per-week noise
        const drift = 1 + (rand(p.id + 'trend') - 0.45) * 0.12 * ((WEEKS - w) / WEEKS)
        const noise = 1 + (rand(`${r.id}${p.id}${w}`) - 0.5) * 0.06
        const promo = rand(`promo${r.id}${p.id}${w}`) > 0.94
        let cents = BASE[p.id] * FACTOR[r.id] * drift * noise * (promo ? 0.8 : 1)
        cents = Math.max(19, Math.round(cents / 10) * 10 - 1) // x.x9 pricing
        const ageDays = w * 7 + (stale ? 10 : Math.floor(rand(r.id + p.id) * 2))
        const member = !promo && rand(`member${r.id}${p.id}${w}`) > 0.8
        out.push({
          memberPriceCents: member ? Math.max(19, Math.round((cents * 0.88) / 10) * 10 - 1) : undefined,
          productId: p.id,
          retailerId: r.id,
          priceCents: cents,
          observedAt: new Date(now - ageDays * DAY - rand(p.id + r.id + w) * 6 * 3600_000).toISOString(),
          source: 'sample',
          isPromotion: promo,
        })
      }
    }
  }
  return out
}

let cache: PriceObservation[] | null = null

export const sampleProvider: PriceProvider = {
  id: 'sample',
  label: 'Sample data',
  isSample: true,
  async getObservations(productIds) {
    cache ??= generate(Date.now())
    const set = new Set(productIds)
    return cache.filter((o) => set.has(o.productId))
  },
}
