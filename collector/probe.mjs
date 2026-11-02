const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); return [r.status, await r.text()] }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [, robots] = await get('https://www.tokmanni.fi/robots.txt')
console.log('SITEMAP LINES:', robots.split('\n').filter((l) => /sitemap/i.test(l)))
for (const sm of robots.split('\n').filter((l) => /^sitemap:/i.test(l)).map((l) => l.split(/:\s*/).slice(1).join(':').trim()).slice(0, 3)) {
  await sleep(10000)
  const [st, xml] = await get(sm)
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  console.log('\n', sm, st, 'locs:', locs.length, locs.slice(0, 8))
}
await sleep(10000)
const [st, html] = await get('https://www.tokmanni.fi/ruoka-ja-juoma')
console.log('\ncategory', st, html.length, [...html.matchAll(/href="(https:\/\/www\.tokmanni\.fi\/[^"?#]+)"/g)].map((m) => m[1]).filter((u) => !/ruoka-ja-juoma/.test(u)).slice(0, 15))
console.log('ld+json:', [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 300)).slice(0, 2))
