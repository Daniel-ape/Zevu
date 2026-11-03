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
console.log(`${n} tests passed`)
