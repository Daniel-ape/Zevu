const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; grocery price comparison)'
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); return [r.status, await r.text()] }
const [rs, robots] = await get('https://view.sok-julkaisut.fi/robots.txt')
console.log('ROBOTS', rs, JSON.stringify(robots.slice(0, 800)))
const [s, html] = await get('https://view.sok-julkaisut.fi/library/kpo?cat=-1&sort=date&dir=desc')
console.log('KPO', s, html.length)
const i = html.indexOf('Published')
console.log('CTX', JSON.stringify(html.slice(Math.max(0, i - 2500), i + 1200)))
const links = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))]
console.log('LINKS', JSON.stringify(links.slice(0, 80)))
const [s2, h2] = await get('https://view.sok-julkaisut.fi/library')
console.log('ROOT', s2, JSON.stringify([...new Set([...h2.matchAll(/library\/([a-z0-9-]+)/g)].map((m) => m[1]))]))
