import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemsEqual, mergeItems } from '../src/domain/listMerge'

const i = (productId: string, quantity = 1, checked = false) => ({ productId, quantity, ...(checked ? { checked } : {}) })

test('changes on both phones are kept', () => {
  const base = [i('milk'), i('bread')]
  const local = [i('milk', 2), i('bread')]          // this phone: two milk
  const remote = [i('milk'), i('bread'), i('eggs')] // other phone: added eggs
  assert.deepEqual(mergeItems(base, local, remote), [i('milk', 2), i('bread'), i('eggs')])
})

test('a removal on this phone wins over an unchanged remote item', () => {
  const base = [i('milk'), i('bread')]
  assert.deepEqual(mergeItems(base, [i('milk')], base), [i('milk')])
})

test('a removal elsewhere is applied when this phone did not touch the item', () => {
  const base = [i('milk'), i('bread')]
  assert.deepEqual(mergeItems(base, base, [i('bread')]), [i('bread')])
})

test('ticking off travels', () => {
  const base = [i('milk')]
  assert.deepEqual(mergeItems(base, base, [i('milk', 1, true)]), [i('milk', 1, true)])
})

test('itemsEqual compares quantity and ticks in order', () => {
  assert.ok(itemsEqual([i('a', 2)], [i('a', 2)]))
  assert.ok(!itemsEqual([i('a', 2)], [i('a', 3)]))
  assert.ok(!itemsEqual([i('a')], [i('a', 1, true)]))
})
