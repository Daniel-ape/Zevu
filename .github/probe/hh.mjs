import { readFileSync, writeFileSync } from 'node:fs'
import { foodRank } from '../../collector/foodGuess.mjs'
const state = JSON.parse(readFileSync('collector/state/halpahalli.json', 'utf8'))
const now = Date.now(), DAY = 86400000
const rows = { 0: {}, 1: {}, 2: {} }
const ex = { 0: { noEan: [], out: [] }, 1: { noEan: [], out: [] } }
for (const [u, s] of Object.entries(state)) {
  const r = foodRank(u); const b = rows[r]
  const k = !s.at ? 'never' : !s.ean ? 'no-ean' : !s.inStock ? 'out-of-stock' : (now - Date.parse(s.at)) > 14 * DAY ? 'older-14d' : 'ok'
  b[k] = (b[k] ?? 0) + 1
  if (r < 2 && k === 'no-ean' && ex[r].noEan.length < 15) ex[r].noEan.push(u)
  if (r < 2 && k === 'out-of-stock' && ex[r].out.length < 10) ex[r].out.push(u + ' ' + s.name)
}
const out = { total: Object.keys(state).length, byRank: rows, examples: ex }
writeFileSync('out/hh.json', JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1))
