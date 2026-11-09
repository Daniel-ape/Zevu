import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cheaperAlternatives, kindWords } from '../src/domain/alternatives'
import type { Product } from '../src/domain/types'

const p = (id: string, name: string, brand: string, amount: number, cents: number, category = 'drinks'): [Product, number] =>
  [{ id, ean: id, name, brand, category, size: { amount, unit: 'g' } } as Product, cents]

test('kindWords leaves the brand out', () => {
  assert.deepEqual(kindWords({ name: 'Paulig Juhla Mokka kahvi', brand: 'Paulig' }), ['juhla', 'mokka', 'kahvi'])
})

test('finds a cheaper coffee of another brand and similar size', () => {
  const items = [
    p('a', 'Paulig Juhla Mokka kahvi', 'Paulig', 500, 699),
    p('b', 'Kulta Katriina Mokka kahvi', 'Kulta Katriina', 500, 499),
    p('c', 'Paulig Presidentti kahvi', 'Paulig', 500, 450), // same brand
    p('d', 'Rainbow Mokka kahvi', 'Rainbow', 2000, 1500), // too big
    p('e', 'Rainbow tee', 'Rainbow', 500, 100), // other kind
    p('f', 'Rainbow Mokka kahvi', 'Rainbow', 450, 680), // not cheaper per kg enough
  ]
  const price = new Map(items.map(([x, c]) => [x.id, c]))
  const alts = cheaperAlternatives(items[0][0], items.map(([x]) => x), (x) => ({ cents: price.get(x.id)!, store: 'S' }))
  assert.deepEqual(alts.map((a) => a.product.id), ['b'])
  assert.equal(alts[0].cheaperBy, 29)
})
