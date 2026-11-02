// Run: npm run test:receipts
import assert from 'node:assert/strict'
import { cleanOcrLine, parseReceipt } from '../src/domain/receipts'

const NOW = new Date('2026-11-02T20:00:00')
const items = (text: string) => parseReceipt(text, NOW).items.map((i) => [i.name, i.quantity, i.priceCents])
let passed = 0
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('ok -', name) }

test('K-store: discount, two-line quantity and weight items, deposit skipped', () => {
  const r = parseReceipt(`K-CITYMARKET PIETARSAARI
02.11.2026 18:42
SKIMMED MILK 1L
  2 KPL X 0,95                1,90
RUISLEIPÄ VIIPALOITU         2,05
PLUSSA-ETU                  -0,30
BANAANI
  0,612 KG X 2,11 €/KG        1,29
PANTTI                       0,20
YHTEENSÄ                    5,14
VISA                        5,14`, NOW)
  assert.equal(r.retailerId, 'k-citymarket')
  assert.equal(r.date.slice(0, 10), '2026-11-02')
  assert.deepEqual(r.items.map((i) => [i.name, i.quantity, i.priceCents]), [
    ['SKIMMED MILK 1L', 2, 190], ['RUISLEIPÄ VIIPALOITU', 1, 175], ['BANAANI', 1, 129],
  ])
  assert.equal(r.totalCents, 514)
})

test('Lidl: VAT letters, Lidl Plus savings, bottle refund not a discount', () => {
  const r = parseReceipt(`Lidl Pietarsaari
Kevätkatu 3
Maito 1,5% 1l          0,95 B
Ruisleipä 500g         1,19 B
Lidl Plus -säästö     -0,20
Pullonpalautus        -0,40
Kurkku                 0,99 B
Yhteensä               2,53
02.11.26`, NOW)
  assert.equal(r.retailerId, 'lidl')
  assert.deepEqual(r.items.map((i) => [i.name, i.priceCents]), [['Maito 1,5% 1l', 95], ['Ruisleipä 500g', 99], ['Kurkku', 99]])
})

test('S-group: trailing minus, bonus lines ignored, Swedish total', () => {
  assert.deepEqual(items(`PRISMA JAKOBSTAD
KAFFE 500G             5,49
KAMPANJA               0,50-
ÄGG 10 ST              2,99
ATT BETALA             7,98
S-ETUKORTTI BONUS 2%`), [['KAFFE 500G', 1, 499], ['ÄGG 10 ST', 1, 299]])
})

test('OCR slips in prices are fixed', () => {
  assert.equal(cleanOcrLine('MAITO 1L  O,95'), 'MAITO 1L  0,95')
  assert.equal(cleanOcrLine('LEIPÄ  1, 29'), 'LEIPÄ  1,29')
  assert.equal(cleanOcrLine('KURKKU  l,29'), 'KURKKU  1,29')
  assert.equal(cleanOcrLine('JUUSTO  3,4O'), 'JUUSTO  3,40')
})

test('Payment and tax lines after the total are ignored', () => {
  assert.equal(items(`K-MARKET\nOMENA 1,99\nYHTEENSÄ 1,99\nALV 14% 0,24\nKORTTI 1,99`).length, 1)
})

test('Discount printed without a minus sign', () => {
  assert.deepEqual(items(`K-MARKET\nJOGURTTI 1KG 2,49\nALENNUS 0,50\nYHTEENSÄ 1,99`), [['JOGURTTI 1KG', 1, 199]])
})

console.log(`${passed} tests passed`)
