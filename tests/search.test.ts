import assert from 'node:assert/strict'
import { haystack, matchScore } from '../src/domain/search'
import type { Product } from '../src/domain/types'

const p = (name: string, brand = '', altName?: string) =>
  haystack({ id: 'x', ean: '6408430000012', name, altName, brand, category: 'dairy', size: { amount: 1, unit: 'l' }, emoji: '' } as Product)

let n = 0
const test = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name) }

test('Swedish words find Finnish products', () => {
  assert.ok(matchScore('mjölk', p('Valio rasvaton maito')) > 0)
  assert.ok(matchScore('smör', p('Valio voi 500 g')) > 0)
  assert.ok(matchScore('kyckling', p('Kariniemen broilerin fileesuikale')) > 0)
})
test('a typo in a longer word still matches', () => {
  assert.ok(matchScore('maitto', p('Rasvaton maito')) > 0)
  assert.ok(matchScore('juhla moka', p('Juhla Mokka kahvi')) > 0)
})
test('dots and rings are optional', () => assert.ok(matchScore('jaatelo', p('Valio jäätelö')) > 0))
test('every word must match', () => assert.equal(matchScore('maito kahvi', p('Rasvaton maito')), 0))
test('unrelated products do not match', () => assert.equal(matchScore('maito', p('Kaurajuoma')), 0))
test('a word in the name beats the same word only in the brand', () =>
  assert.ok(matchScore('voi', p('Valio voi')) > matchScore('voi', p('Luomuhunaja', 'Voi hyvin'))))
test('barcode digits match', () => assert.ok(matchScore('6408430', p('x')) > 0))

// Receipt lines → products
import { matchLine, lineKey } from '../src/domain/receipts'
const prod = (id: string, name: string, brand = '') => ({ id, ean: id, name, brand, category: 'dairy', size: { amount: 1, unit: 'l' }, emoji: '' } as Product)
const catalogue = [
  prod('a', 'Rasvaton maito', 'Valio'), prod('b', 'Rasvaton Maitojauhe', 'Valio'), prod('c', 'Juhla Mokka', 'Paulig'), prod('d', 'Proteiinijuoma Banaani', 'Pirkka'),
]
test('receipt abbreviations find the product', () => assert.equal(matchLine('VALIO RASV MAITO 1L', catalogue)?.id, 'a'))
test('the closest product wins over a longer one', () => assert.equal(matchLine('VALIO RASVATON MAITO', catalogue)?.id, 'a'))
test('a weak match is only a guess', () => assert.equal(matchLine('PIRKKA BANAANI', catalogue)?.sure, false))
test('non-products are not linked', () => assert.equal(matchLine('PANTTI', catalogue), undefined))
test('a line linked before is recognised', () => assert.deepEqual(matchLine('KAHVI 500G', catalogue, { [lineKey('KAHVI 500G')]: 'c' }), { id: 'c', sure: true }))

// Splitting the shop between two stores
import { splitPlan } from '../src/domain/pricing'
const R = [{ id: 'a', name: 'A', chain: 'lidl' }, { id: 'b', name: 'B', chain: 'tokmanni' }, { id: 'c', name: 'C', chain: 'halpahalli' }] as const
const now = Date.parse('2026-11-03T12:00:00Z')
const obs = (productId: string, retailerId: string, priceCents: number) => ({ productId, retailerId, priceCents, observedAt: '2026-11-03T06:00:00Z', source: 'shop' as const })
const prods = ['x', 'y', 'z'].map((id) => prod(id, id))
const prices: Record<string, ReturnType<typeof obs>[]> = {
  x: [obs('x', 'a', 100), obs('x', 'b', 150)],
  y: [obs('y', 'a', 300), obs('y', 'b', 200)],
  z: [obs('z', 'a', 50), obs('z', 'b', 60), obs('z', 'c', 40)],
}
const shopList = { id: 'l', name: 'L', items: [{ productId: 'x', quantity: 1 }, { productId: 'y', quantity: 2 }, { productId: 'z', quantity: 1 }] }
test('two stores beat one when they save money', () => {
  const plan = splitPlan(shopList, prods, (id) => prices[id] ?? [], [...R], now)
  assert.ok(plan)
  assert.equal(plan!.totalCents, 100 + 400 + 50)          // x at A, y at B, z at A
  assert.equal(plan!.single?.totalCents, 150 + 400 + 60)  // all at B
  assert.equal(plan!.savingCents, 60)
})
test('no plan when one store is already cheapest for everything', () => {
  const cheapA = { x: [obs('x', 'a', 100), obs('x', 'b', 150)], y: [obs('y', 'a', 100), obs('y', 'b', 200)] } as Record<string, ReturnType<typeof obs>[]>
  assert.equal(splitPlan({ id: 'l', name: 'L', items: [{ productId: 'x', quantity: 1 }, { productId: 'y', quantity: 1 }] }, prods, (id) => cheapA[id] ?? [], [...R], now), null)
})
console.log(`${n} tests passed`)
