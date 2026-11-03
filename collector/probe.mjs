import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
const d = JSON.parse(readFileSync('public/prices/leaflets.json', 'utf8'))
let i = 0
for (const l of d.tokmanni.slice(0, 2)) {
  const buf = Buffer.from(await (await fetch(l.image)).arrayBuffer())
  writeFileSync(`/tmp/t${i}.jpg`, buf)
  execSync(`node -e "require('sharp')('/tmp/t${i}.jpg').resize(400).jpeg({quality:70}).toFile('/tmp/s${i}.jpg')"`)
  console.log('B64', i, readFileSync(`/tmp/s${i}.jpg`).toString('base64'))
  const v = JSON.parse(Buffer.from(new URL(l.image).searchParams.get('v'), 'base64').toString())
  for (const u of [
    `https://cdn.ipaper.io/iPaper/Papers/${v.PaperGuid}/Pages/1/Normal.jpg`,
    `https://cdn.ipaper.io/iPaper/Papers/${v.PaperGuid}/Pages/1/Zoom.jpg`,
    `https://files.cdn.ipaper.io/iPaper/Papers/${v.PaperGuid}/Pages/1/Normal.jpg`,
    `https://cdn.ipaper.io/iPaper/Papers/${v.PaperGuid}/Pages/1/Thumb.jpg`,
  ]) { const r = await fetch(u); console.log('TRY', r.status, r.headers.get('content-type'), u) }
  i++
}
