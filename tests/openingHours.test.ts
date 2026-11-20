import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clock, openStatus, parseHours } from '../src/domain/openingHours'

// 2026-11-20 is a Friday
const at = (iso: string) => new Date(iso)

test('weekday rules', () => {
  const w = parseHours('Mo-Fr 07:00-21:00; Sa 08:00-21:00; Su 10:00-18:00')
  assert.deepEqual(openStatus(w, at('2026-11-20T20:10:00')), { open: true, until: 1260 })
  assert.deepEqual(openStatus(w, at('2026-11-20T21:30:00')), { open: false, opensIn: 1, at: 480 })
  assert.deepEqual(openStatus(w, at('2026-11-22T08:00:00')), { open: false, opensIn: 0, at: 600 })
})

test('24/7 and every day', () => {
  assert.deepEqual(openStatus(parseHours('24/7')), { open: true, always: true })
  assert.deepEqual(openStatus(parseHours('Mo-Su 07:00-23:00'), at('2026-11-20T06:00:00')), { open: false, opensIn: 0, at: 420 })
})

test('lists of days, off days, a comma between rules, holidays ignored', () => {
  const w = parseHours('Mo-Fr 08:00-21:00, Sa,Su 09:00-18:00; PH off')
  assert.deepEqual(openStatus(w, at('2026-11-21T17:00:00')), { open: true, until: 1080 })
  const off = parseHours('Mo-Sa 07:00-21:00; Su off')
  assert.deepEqual(openStatus(off, at('2026-11-22T12:00:00')), { open: false, opensIn: 1, at: 420 })
})

test('open past midnight', () => {
  const w = parseHours('Mo-Su 07:00-02:00')
  assert.deepEqual(openStatus(w, at('2026-11-20T01:00:00')), { open: true, until: 120 })
  assert.equal(clock(1440), '24')
  assert.equal(clock(1290), '21.30')
})

test('unknown text gives nothing', () => {
  assert.equal(parseHours('by appointment'), null)
  assert.equal(parseHours(undefined), null)
})
