// Numbers for the homepage, from the same daily price bundles the apps read:
// how many products and shops there are, and how much the same everyday food
// differs in price between shops on average (for the savings estimate). Written to site/data/stats.json during
// the Pages deploy (not committed). No shop names and no product prices are
// published: the homepage shows neither.
import fs from 'node:fs'
import { categoryFor } from '../src/domain/categories'

type Item = [string, number, string, string, string, string, string, 1?]
interface Shop { r: string; at: string; o: string; p?: string; i: Item[] }

const FOOD_SHOPS = new Set(['prisma', 's-market', 'alepa', 'k-citymarket', 'k-market', 'lidl', 'minimani', 'halpahalli', 'tokmanni', 'stockmann', 'ruohonjuuri'])
const FOOD = new Set(['dairy', 'bread', 'produce', 'meat', 'pantry', 'drinks', 'snacks', 'frozen'])
// things a shopper would not call groceries, even if the name looks like food
const SKIP = /proteiini|whey|detox|gel\b|geeli|linnuille|lintu|hau-hau|koira|kissa|silikoni|alusta|palautus|kreatiini|lisäravin|sensitive|gluteeniton|luomu.*kapseli|nutrition|sportlife|\bvalo24h/i

const shops: Shop[] = []
for (const f of ['core', 'rest']) {
  const path = `public/prices/app/${f}.json`
  if (fs.existsSync(path)) shops.push(...JSON.parse(fs.readFileSync(path, 'utf8')).shops)
}

const all = new Set<string>()
const retailers = new Set<string>()
const by = new Map<string, { name: string; p: Map<string, number> }>()
for (const s of shops) {
  if (s.i.length) retailers.add(s.r)
  for (const [ean, cents, name] of s.i) {
    all.add(ean)
    if (!FOOD_SHOPS.has(s.r) || !cents || cents < 30) continue
    let e = by.get(ean)
    if (!e) by.set(ean, (e = { name, p: new Map() }))
    const old = e.p.get(s.r)
    if (old == null || cents < old) e.p.set(s.r, cents)
  }
}

const pcts: number[] = []
for (const e of by.values()) {
  if (e.p.size < 3) continue
  if (!FOOD.has(categoryFor(e.name, 'prisma')) || SKIP.test(e.name)) continue
  const v = [...e.p.values()]
  const lo = Math.min(...v), hi = Math.max(...v)
  if (hi / lo > 2.5) continue // more likely two pack sizes than one product
  const pct = Math.round((1 - lo / hi) * 100)
  pcts.push(pct)
}
const avg = pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : 0

const out = {
  builtAt: new Date().toISOString(),
  products: all.size,
  shops: retailers.size,
  compared: pcts.length,
  avgGap: avg,
}
fs.mkdirSync('site/data', { recursive: true })
fs.writeFileSync('site/data/stats.json', JSON.stringify(out))
console.log(`site stats: ${out.products} products, ${out.shops} shops, ${out.compared} compared, avg gap ${avg} %`)
