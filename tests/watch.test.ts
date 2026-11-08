import { test } from 'node:test'
import assert from 'node:assert/strict'
import { offerIsFor, watchHit } from '../src/domain/watch'

test('watch: cheaper than when watched, or at the target price', () => {
  assert.equal(watchHit(199, { baselineCents: 249 }), true)
  assert.equal(watchHit(249, { baselineCents: 249 }), false)
  assert.equal(watchHit(219, { baselineCents: 249, targetCents: 200 }), false)
  assert.equal(watchHit(199, { baselineCents: 249, targetCents: 200 }), true)
  // already told about 199: only a lower price counts again
  assert.equal(watchHit(199, { baselineCents: 249, targetCents: 200 }, 199), false)
  assert.equal(watchHit(null, { baselineCents: 249 }), false)
})

test('watch: leaflet offers are matched to the product, not its whole kind', () => {
  const magnesium = { name: 'Puhdistamo Tripla Magnesium 120 kapselia', brand: 'Puhdistamo' }
  assert.equal(offerIsFor(magnesium, 'Puhdistamo ILTA TAI TRIPLA MAGNESIUM'), true)
  const fazer = { name: 'Karl Fazer maitosuklaa suklaapatukka 39g', brand: 'Karl Fazer' }
  assert.equal(offerIsFor(fazer, 'KARL FAZER Makukonvehdit'), false)
  const keitto = { name: 'Kivikylän Palvarin Hernekeitto 435g', brand: 'Kivikylän' }
  assert.equal(offerIsFor(keitto, 'KIVIKYLÄN Palvarin lihapyörykkä'), false)
  const mince = { name: 'Atria Naudan jauheliha 10 % 400 g', brand: 'Atria' }
  assert.equal(offerIsFor(mince, 'Jauheliha'), false)
  assert.equal(offerIsFor({ name: 'Serla Hellä WC-paperi 8rl valkoinen', brand: 'Serla' }, 'Serla HELLÄ WC-PAPERI'), true)
})
