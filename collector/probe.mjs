// TEMPORARY: Power product JSON-LD offers
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
for (const u of ['https://www.power.fi/koti-ja-piha/piha-ja-vapaa-aika/grillaus/grillitarvikkeet/grillien-lisatarvikkeet/weber-26104-grillinpuhdistusaine-250-ml/p-101024/', 'https://www.power.fi/tietotekniikka/tulostus/mustekasetit/hp-364-cb317ee-valokuvamustekasetti-blistered/p-126415/']) {
  const h = await (await fetch(u, { headers: { 'User-Agent': UA } })).text()
  const ld = JSON.parse(h.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/)[1])
  for (const x of ld['@graph']) if (x['@type'] === 'Product') console.log(JSON.stringify({ name: x.name, gtin13: x.gtin13, offers: x.offers }).slice(0, 900))
  await new Promise((r) => setTimeout(r, 1500))
}
