import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetStatus, parseEuros } from '../src/domain/budget'

test('status, days left and pace', () => {
  const s = budgetStatus(40000, 20000, new Date(2026, 10, 15, 12))
  assert.equal(s.leftCents, 20000)
  assert.equal(s.daysLeft, 15)
  assert.equal(s.level, 'ok')
  assert.equal(s.projectedCents, 40000)
})
test('near and over', () => {
  assert.equal(budgetStatus(40000, 33000).level, 'near')
  assert.equal(budgetStatus(40000, 41000).level, 'over')
})
test('no pace in the first days', () => {
  assert.equal(budgetStatus(40000, 5000, new Date(2026, 10, 3)).projectedCents, undefined)
})
test('amounts typed by hand', () => {
  assert.equal(parseEuros('400'), 40000)
  assert.equal(parseEuros('400,50 €'), 40050)
  assert.equal(parseEuros('1 200'), 120000)
  assert.equal(parseEuros('5'), undefined)
  assert.equal(parseEuros('abc'), undefined)
})

import { buyAdvice } from '../src/domain/pricing'
test('buy advice', () => {
  const pts = (a: number[]) => a.map((cents) => ({ cents }))
  assert.equal(buyAdvice(pts(Array(10).fill(500))), null)
  assert.equal(buyAdvice(pts([...Array(25).fill(500), 399]))?.kind, 'good')
  const w = buyAdvice(pts([...Array(10).fill(500), ...Array(5).fill(399), ...Array(10).fill(500)]))
  assert.equal(w?.kind, 'wait'); assert.equal(w && 'low' in w && w.low, 399)
  assert.equal(buyAdvice(pts(Array(30).fill(500)))?.kind, 'normal')
})
