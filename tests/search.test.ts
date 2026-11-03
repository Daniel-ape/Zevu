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
console.log(`${n} tests passed`)
