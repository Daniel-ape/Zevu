const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; grocery price comparison)'
for (const u of ['https://www.tokmanni.fi/tarjouslehti', 'https://tarjoussanomat.tokmanni.fi/']) {
  const r = await fetch(u, { headers: { 'User-Agent': UA } })
  const html = await r.text()
  console.log('PAGE', u, r.status, r.url, html.length)
  const links = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))].filter((h) => /ipaper|tarjoussanomat|kuvasto|lehti|catalog/i.test(h))
  console.log('LINKS', JSON.stringify(links.slice(0, 40)))
  const i = html.search(/ipaper/i)
  if (i > 0) console.log('CTX', JSON.stringify(html.slice(i - 1500, i + 1500)))
}
console.log('ROBOTS2', JSON.stringify((await (await fetch('https://tarjoussanomat.tokmanni.fi/robots.txt', { headers: { 'User-Agent': UA } })).text()).slice(0, 600)))
