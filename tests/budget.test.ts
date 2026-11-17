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
