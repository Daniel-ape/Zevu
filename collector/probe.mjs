const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const h = await (await fetch('https://www.lidl.fi/c/tarjouslehdet/s10019134', { headers: { 'User-Agent': UA } })).text()
for (const m of h.matchAll(/(esi[^"'\s]{0,200}|data-query="[^"]+"|region[^"'\s]{0,80})/gi)) console.log('HIT', m[0].slice(0, 220))
const i = h.indexOf('leaflets-overview-app'); console.log('CTX', JSON.stringify(h.slice(i - 600, i + 300)))
// Halpa-Halli: what the publitas group holds, and the catalog widget config
const hh = await (await fetch('https://www.halpahalli.fi/mainokset', { headers: { 'User-Agent': UA } })).text()
for (const m of hh.matchAll(/publitas[^"'\s<]{0,160}/gi)) console.log('HH', m[0])
const j = hh.indexOf('publitascatalogs'); console.log('HHCTX', JSON.stringify(hh.slice(j - 300, j + 400)))
