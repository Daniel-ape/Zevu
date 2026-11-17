// The order a typical Finnish supermarket is walked in, a little finer than
// the app's categories: frozen food and coffee & tea get their own stops,
// because they sit far from the rest of the pantry.
import type { CategoryId, Product } from './types'

export type Aisle = CategoryId | 'frozen' | 'coffee' | 'fish'

export const AISLE_ORDER: Aisle[] = [
  'produce', 'bread', 'meat', 'fish', 'dairy', 'pantry', 'coffee', 'frozen', 'snacks', 'drinks',
  'household', 'health', 'pets', 'home', 'electronics', 'toys', 'clothing', 'office',
]

const FROZEN = /pakaste|pakastet|jäädytet|jäätelö|\bfryst|\bglass\b|frozen/i
const COFFEE = /kahvi|kaffe|coffee|espresso|cappuccino|\btee\b|\bteetä|\bte\b|\btea\b|kaakao|kakao|cocoa/i
const FISH = /lohi|lohta|silakka|silli|tonnikala|seiti|turska|\bkala|kala\b|katkarap|\blax|\bsill\b|torsk|tonfisk|\bfisk|räkor|salmon|tuna|shrimp|\bfish/i

export function aisleOf(p: Pick<Product, 'name' | 'category'>): Aisle {
  const c = p.category
  if (c === 'pantry' || c === 'snacks' || c === 'meat' || c === 'dairy') {
    if (FROZEN.test(p.name)) return 'frozen'
  }
  if ((c === 'pantry' || c === 'drinks') && COFFEE.test(p.name) && !/maito|mjölk|milk|juoma\b|drink|iced|jää/i.test(p.name)) return 'coffee'
  if (c === 'meat' && FISH.test(p.name)) return 'fish'
  return c
}

/** Groups in walking order; within a group, the order the list had. */
export function byAisle<T>(rows: T[], aisle: (r: T) => Aisle): { aisle: Aisle; rows: T[] }[] {
  const m = new Map<Aisle, T[]>()
  for (const r of rows) {
    const a = aisle(r)
    m.set(a, [...(m.get(a) ?? []), r])
  }
  return AISLE_ORDER.filter((a) => m.has(a)).map((a) => ({ aisle: a, rows: m.get(a)! }))
}

/** Text key for an aisle's heading. */
export const aisleLabel = (a: Aisle) => (a === 'frozen' || a === 'coffee' || a === 'fish' ? `aisle.${a}` : `cat.${a}`)
