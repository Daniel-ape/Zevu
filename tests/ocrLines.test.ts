import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linesToText } from '../src/domain/ocrLines'
import { parseReceipt } from '../src/domain/receipts'

test('name and price read as separate pieces end up on one row', () => {
  const t = linesToText([
    { text: 'K-Supermarket Kivikko', x: 0.2, y: 0.02, w: 0.6, h: 0.02 },
    { text: 'MAITO 1L', x: 0.05, y: 0.10, w: 0.3, h: 0.02 },
    { text: '1,29', x: 0.8, y: 0.103, w: 0.1, h: 0.02 },
    { text: 'RUISLEIPÄ', x: 0.05, y: 0.13, w: 0.3, h: 0.02 },
    { text: '2,49', x: 0.8, y: 0.128, w: 0.1, h: 0.02 },
    { text: 'YHTEENSÄ', x: 0.05, y: 0.18, w: 0.3, h: 0.025 },
    { text: '3,78', x: 0.8, y: 0.181, w: 0.1, h: 0.025 },
  ])
  assert.equal(t.split('\n').length, 4)
  const r = parseReceipt(t, new Date('2026-11-20'))
  assert.equal(r.retailerId, 'k-supermarket')
  assert.deepEqual(r.items.map((i) => [i.name, i.priceCents]), [['MAITO 1L', 129], ['RUISLEIPÄ', 249]])
  assert.equal(r.totalCents, 378)
})

test('pieces that overlap sideways stay on separate rows', () => {
  const t = linesToText([
    { text: 'A', x: 0.1, y: 0.10, w: 0.3, h: 0.02 },
    { text: 'B', x: 0.2, y: 0.105, w: 0.3, h: 0.02 },
  ])
  assert.equal(t, 'A\nB')
})
