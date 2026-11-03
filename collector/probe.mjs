import { readFileSync } from 'node:fs'
const d = JSON.parse(readFileSync('public/prices/leaflets.json', 'utf8'))
const og = d.tokmanni[0].image
const v = JSON.parse(Buffer.from(new URL(og).searchParams.get('v'), 'base64').toString())
console.log('V', JSON.stringify(v))
const tryUrl = async (u, ua) => {
  try { const r = await fetch(u, { headers: ua ? { 'User-Agent': ua } : {} }); const b = await r.arrayBuffer(); console.log('TRY', r.status, r.headers.get('content-type'), b.byteLength, u.slice(0, 160)) } catch (e) { console.log('TRY ERR', e.message, u.slice(0, 120)) }
}
const SAF = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
await tryUrl(og, SAF)
await tryUrl(og)
const html = await (await fetch(d.tokmanni[0].url, { headers: { 'User-Agent': SAF } })).text()
const imgs = [...new Set([...html.matchAll(/https?:\/\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)[^"'\s)]*/gi)].map((m) => m[0]))]
console.log('IMGS', JSON.stringify(imgs.slice(0, 20)))
const i = html.search(/PaperGuid|paperGuid|Pages\//)
console.log('CTX', JSON.stringify(html.slice(Math.max(0, i - 400), i + 800)))
