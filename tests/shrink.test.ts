import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findShrinks, nameStem, updateSizes, type SizeDb } from '../src/domain/shrink'

test('name stem drops the size', () => {
  assert.equal(nameStem('Fazer Sininen 200g suklaalevy'), nameStem('Fazer Sininen 180 g suklaalevy'))
})

test('same barcode, smaller pack, same price', () => {
  const db: SizeDb = { since: '2026-01-01', items: {} }
  updateSizes(db, [['1', 'Fazer Sininen 200g', 'Fazer', 349]], '2026-01-01')
  updateSizes(db, [['1', 'Fazer Sininen 180g', 'Fazer', 349]], '2026-02-01')
  const s = findShrinks(db, '2026-02-02')
  assert.deepEqual(s, [['1', '1', 200, 180, 'g', '2026-02-01', 349, 349]])
})

test('new barcode replaces the old one', () => {
  const db: SizeDb = { since: '2026-01-01', items: {} }
  updateSizes(db, [['1', 'Juhla Mokka 500g', 'Paulig', 699]], '2026-01-01')
  updateSizes(db, [], '2026-02-01')
  updateSizes(db, [['2', 'Juhla Mokka 450g', 'Paulig', 699]], '2026-02-03')
  assert.deepEqual(findShrinks(db, '2026-02-04').map((s) => [s[0], s[1], s[2], s[3]]), [['2', '1', 500, 450]])
})

test('smaller pack at a lower price per kilo is not a shrink', () => {
  const db: SizeDb = { since: '2026-01-01', items: {} }
  updateSizes(db, [['1', 'Juhla Mokka 500g', 'Paulig', 700]], '2026-01-01')
  updateSizes(db, [['1', 'Juhla Mokka 450g', 'Paulig', 600]], '2026-02-01')
  assert.equal(findShrinks(db, '2026-02-02').length, 0)
})

test('first week does not count as new', () => {
  const db: SizeDb = { since: '2026-01-01', items: {} }
  updateSizes(db, [['1', 'Juhla Mokka 500g', 'Paulig', 699]], '2026-01-01')
  updateSizes(db, [['2', 'Juhla Mokka 450g', 'Paulig', 699]], '2026-01-03')
  assert.equal(findShrinks(db, '2026-01-04').length, 0)
})
