// One-off probe: what do the stores' public endpoints allow and return?
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const show = (label, v) => console.log(`\n=== ${label}\n${typeof v === 'string' ? v.slice(0, 1500) : JSON.stringify(v, null, 1).slice(0, 2500)}`)
async function get(url, headers = {}) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } })
    return `${r.status} ${await r.text()}`
  } catch (e) { return 'ERR ' + e }
}
for (const u of ['https://www.s-kaupat.fi/robots.txt', 'https://api.s-kaupat.fi/robots.txt', 'https://www.k-ruoka.fi/robots.txt', 'https://www.lidl.fi/robots.txt', 'https://www.tokmanni.fi/robots.txt'])
  show(u, await get(u))

const gql = (op, vars, hash) => 'https://api.s-kaupat.fi/?' + new URLSearchParams({
  operationName: op, variables: JSON.stringify(vars),
  extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }),
})
const H = { Accept: 'application/json', Origin: 'https://www.s-kaupat.fi', Referer: 'https://www.s-kaupat.fi/' }
const stores = await get(gql('RemoteStoreSearch', { query: 'Pietarsaari', brand: null, cursor: null }, 'e49317e01c3a57b286fadd6f3ea47fd1d64adebb483943ba0e229307d15763b5'), H)
show('S store search Pietarsaari', stores)
let storeId = '513971200'
try { storeId = JSON.parse(stores.slice(4)).data.searchStores.stores[0].id } catch {}
show('S products maito @' + storeId, await get(gql('RemoteFilteredProducts', {
  facets: [], from: 0, limit: 3, queryString: 'maito', slug: '', storeId, fetchSponsoredContent: false, includeAgeLimitedByAlcohol: false, useRandomId: false,
}, '48756d592aa8fe6f1c9f560440bbdf8ce390ec3110fa34fc89b298c7d7a3bd4f'), H))
show('K-Ruoka search', await get('https://www.k-ruoka.fi/kr-api/v2/product-search/maito?storeId=N106&offset=0&limit=3', { Accept: 'application/json' }))
