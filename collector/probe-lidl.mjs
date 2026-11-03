const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; grocery price comparison)'
const html = await (await fetch('https://www.lidl.fi/c/tarjouslehdet/s10019134', { headers: { 'User-Agent': UA } })).text()
const i = html.indexOf('imgproxy.leaflets')
console.log('CTX1', JSON.stringify(html.slice(i - 2500, i + 1500)))
const j = html.indexOf('imgproxy.leaflets', i + 100)
console.log('CTX2', JSON.stringify(html.slice(j - 1200, j + 600)))
