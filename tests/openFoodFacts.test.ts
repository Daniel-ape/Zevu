// Run: npm run test:off — checks the connector against the documented API shape (fetch is mocked).
import assert from 'node:assert/strict'
import { lookupBarcode, OffUnavailable, parseQuantity, searchProducts } from '../src/data/openFoodFacts'

let passed = 0
const test = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log('ok -', name) }
const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = (async (url: string) => {
    lastUrl = String(url)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
}
let lastUrl = ''

await test('quantities', () => {
  assert.deepEqual(parseQuantity('1 l'), { amount: 1000, unit: 'ml' })
  assert.deepEqual(parseQuantity('350 g'), { amount: 350, unit: 'g' })
  assert.deepEqual(parseQuantity('1,5 kg'), { amount: 1500, unit: 'g' })
  assert.deepEqual(parseQuantity('6 x 0,33 l'), { amount: 1980, unit: 'ml' })
  assert.deepEqual(parseQuantity('10 kpl'), { amount: 10, unit: 'pcs' })
  assert.deepEqual(parseQuantity('150 gram'), { amount: 150, unit: 'g' })
  assert.deepEqual(parseQuantity(undefined), { amount: 0, unit: 'pcs' })
})

await test('barcode lookup maps a product (Finnish name preferred)', async () => {
  mockFetch(200, { status: 1, code: '6430015538498', product: {
    product_name: 'Aito oat drink organic', product_name_fi: 'Aito kaurajuoma luomu', brands: 'Fazer,Fazer Aito',
    quantity: '1 l', categories_tags: ['en:plant-based-foods-and-beverages', 'en:beverages', 'en:plant-milks'],
    image_front_small_url: 'https://images.openfoodfacts.org/x.jpg' } })
  const p = await lookupBarcode('6430015538498', 'fi')
  assert.ok(lastUrl.startsWith('https://world.openfoodfacts.org/api/v2/product/6430015538498.json'))
  assert.equal(p?.id, 'off:6430015538498')
  assert.equal(p?.name, 'Aito kaurajuoma luomu')
  assert.equal(p?.brand, 'Fazer')
  assert.deepEqual(p?.size, { amount: 1000, unit: 'ml' })
  assert.equal(p?.category, 'dairy') // plant milks sit in the dairy aisle in Finnish stores
  assert.equal(p?.infoSource, 'open-food-facts')
})

await test('unknown barcode returns null', async () => {
  mockFetch(404, { status: 0, status_verbose: 'product not found' })
  assert.equal(await lookupBarcode('6400000000000', 'fi'), null)
  mockFetch(200, { status: 0 })
  assert.equal(await lookupBarcode('6400000000000', 'fi'), null)
})

await test('network failure is reported as unavailable', async () => {
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
  await assert.rejects(lookupBarcode('6430015538498', 'fi'), OffUnavailable)
  mockFetch(503, {})
  await assert.rejects(lookupBarcode('6430015538498', 'fi'), OffUnavailable)
})

await test('search is limited to Finland and skips nameless products', async () => {
  mockFetch(200, { products: [
    { code: '6437002001911', product_name: 'Ranskanleipä', brands: 'Vaasan', quantity: '350 g', categories_tags: ['en:breads'] },
    { code: '123' },
  ] })
  const res = await searchProducts('ranskanleipä', 'fi')
  assert.ok(lastUrl.includes('tag_0=finland') && lastUrl.includes('search_terms=ranskanleip'))
  assert.equal(res.length, 1)
  assert.equal(res[0].category, 'bread')
})

console.log(`${passed} tests passed`)
