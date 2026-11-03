const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; grocery price comparison)'
const r = await fetch('https://www.lidl.fi/c/tarjouslehdet/s10019134', { headers: { 'User-Agent': UA } })
const html = await r.text()
const urls = [...new Set([...html.matchAll(/https?:\/\/[^"'\s<>)]*(schwarz|leaflet|flyer|esite)[^"'\s<>)]*/gi)].map((m) => m[0]))]
console.log('URLS', JSON.stringify(urls.slice(0, 40)))
for (const m of html.matchAll(/leaflet|flyer|esi:include|data-src/gi)) {
  if ((globalThis.n = (globalThis.n || 0) + 1) > 12) break
  console.log('CTX', JSON.stringify(html.slice(Math.max(0, m.index - 200), m.index + 300)))
}
const t = await (await fetch('https://www.lidl.fi/robots.txt', { headers: { 'User-Agent': UA } })).text()
console.log('ROBOTS', JSON.stringify(t.slice(0, 1500)))
