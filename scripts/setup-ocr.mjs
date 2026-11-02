// Copies the on-device text recognition engine and Finnish/Swedish language
// data into public/ocr. Runs automatically after `npm install`.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const out = 'public/ocr'
mkdirSync(`${out}/lang`, { recursive: true })
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`)
for (const v of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  cpSync(`node_modules/tesseract.js-core/tesseract-core-${v}.wasm.js`, `${out}/tesseract-core-${v}.wasm.js`)
}
// Language data is wrapped in .js files so it can be served from any static host.
for (const l of ['fin', 'swe']) {
  const gz = readFileSync(`node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`)
  writeFileSync(`${out}/lang/${l}.js`, `self.LANG_${l}="${gz.toString('base64')}";`)
}
console.log('OCR assets ready in public/ocr')
