// Prices collected daily by collector/*.mjs and published with the app
// (public/prices/*.json). Each file lists prices by barcode for one store.

import type { CategoryId, PriceObservation, PriceProvider, PriceSource, Product } from '../domain/types'
import { fetchData } from './dataFile'
import { parseQuantity } from './openFoodFacts'

interface File {
  retailerId: string
  fetchedAt: string
  prices: { ean: string; priceCents: number; checkedAt?: string; name?: string; brand?: string; image?: string; url?: string }[]
}

const files = new Map<string, Promise<File | null>>()
const load = (file: string) => {
  if (!files.has(file)) files.set(file, fetchData<File>(file))
  return files.get(file)!
}

// Category guess from a Finnish/Swedish product name; the first match wins.
// Non-food words come first so "kissanruoka" is pet food and "puhdistusmaito"
// is skin care. Shops that sell no food never get a food category.
const NONFOOD: [RegExp, CategoryId][] = [
  // Books are listed "Surname, Title" by Prisma; also calendars, paper and office supplies.
  [/^[A-ZÅÄÖ][\wåäöéü'\-]+(?: [A-ZÅÄÖ][\wåäöéü'\-]+)?, [A-ZÅÄÖ0-9@]|kirja\b|romaani|kalenteri|muistikirja|vihko|kansio|mappi|\bA4\b|\bA5\b|\bA6\b|kartonki|tulostuspaperi|kopiopaperi|kirjekuori|kuulakärkikynä|lyijykynä|tussi|\bkynä\b|nitoja|teippi|post-it|muistilappu/i, 'office'],
  [/koira|kissa|lemmik|jyrsijä|akvaario|kaneille|hevose|\bhund|\bkatt\b|kattmat|kattleksak|pururull|puruluu|purutikku|täysravinto|kuivaruoka|märkäruoka|herkkupal|mahalastu|päänahka|almo nature|friskies|whiskas|pedigree|royal canin|purina|\bsoossi|mush snacks|viljaton|riista-riisi|kana-riisi|makkaratikku|\bvet\b/i, 'pets'],
  [/lelu|lego|nukke|palapeli|lautapeli|seurapeli|pehmo|leikki|playmobil|barbie|hot wheels|figuuri|leksak|funko|sylvanian|brio\b|schleich|kilpa-auto|pienoismalli|squishmallow/i, 'toys'],
  [/puhelin|kuuloke|kaiutin|televisio|\btv\b|kannettava|tietokone|näyttö|laturi|kaapeli|\busb|hdmi|bluetooth|kamera|konsoli|playstation|xbox|nintendo|ipad|iphone|galaxy|hiiri\b|näppäimistö|reititin|muistikortti|\bssd\b|älykello|powerbank|virtapankki|tulostin|projektori|mikrofoni|mustekasetti|värikasetti|levysoitin/i, 'electronics'],
  // Kitchen tools and appliances before food words ("juustohöylä", "perunasurvin").
  [/höylä|survin|leikkuri|puristin|lautanen|lautasliina|tuoppi|letku|vesiautomaatti|höyrystin|kulho|vuoka|lyhty|ilmanraikastin|pesukone|kuivausrumpu|jääkaappi|pakastin|mikroaaltouuni|imuri|vedenkeitin|kahvinkeitin|leipäkone|tehosekoitin|airfryer|koriste|tarra|glitter|timanttimaalaus|lanka\b|\bwool\b|saippua-alusta|saippuapullo|hammasharjateline|annostelija|kynttilä|lasilyhty/i, 'home'],
  [/shampoo|hoitoaine|voide|vitamiini|tabletit|kapseli|hammastahna|hammasharja|deodorantti|antiperspirant|meikki|meikin|makeup|make up|luomiväri|paletti|ripsiväri|huuli|kynsilakka|lakka\b|parfyymi|hajuvesi|eau de|tuoksu|ihon|aurinkosuoja|laastari|kosteus|seerumi|serum|suihkusaippua|saippua|partak|kasvo|\bface\b|hius|kynsi|lääke|särky|nenäsumute|silmätipat|probiootti|omega|magnesium|kalsium|puhdistusmaito|puhdistusöljy|cleans|cream|lotion|balsami|kosmetiikka|ripsi|kulmakynä|sidos\b|vaippa/i, 'health'],
  [/pesuaine|puhdistusaine|siivous|tiskiaine|pyykin|roskapussi|talouspaperi|wc-paperi|huuhteluaine|tahranpoist|astianpesuaine|lattiasiivous/i, 'household'],
  [/paita\b|paita,|t-paita|housut|takki\b|takki,|mekko|hame\b|sukat|sukkahousut|kengät|saappaat|pipo|hanskat|lapaset|farkut|alushousut|rintaliivit|huppari|neule\b|neuletakki|villapaita|pyjama|uimapuku|bokserit|huivi|koru\b|korvakoru|kaulakoru|rannekoru|sormus/i, 'clothing'],
  [/lamppu|valaisin|matto|tyyny|peitto|lakana|pyyhe|verho|kattila|paistinpannu|pannu\b|astia|muki|lasi\b|lasit\b|juomalasi|veitsi|työkalu|ruuvi|porakone|puutarha|ruukku|tuoli|pöytä|hylly|säilytys|laatikko|kori\b|sisustus|teline|sakset|vasara|maali\b|liima|grilli|savustus|jatkojohto|paristo|keitin|kone\b|blender|termos|pullo\b|juomapullo|henkari/i, 'home'],
]
const FOOD: [RegExp, CategoryId][] = [
  [/suklaa|karkki|makeinen|sipsi|keksi|choklad|godis|chips|pastilli|purukumi|konvehti|snacks|sipsi\b|suolakeksi|maissikakku/i, 'snacks'],
  [/maito\b|maitoa|maitojuoma|juusto|jogurtti|kuohukerma|ruokakerma|vispikerma|\bvoi\b|rahka|viili|kananmun|munat\b|mjölk|\bost\b/i, 'dairy'],
  [/leipä\b|leipää|leipä,|sämpylä|näkki|korppu|\bbröd|pulla\b|pullava|paahto|patonki|ruisrieska|tortilla|piirakka|croissant|munkki\b|sämpyl/i, 'bread'],
  [/makkara|nakki|kinkku|broiler|kanafile|kananpoika|kanan |jauheliha|naudan|porsaan|possun|lohifile|kalapuikko|tonnikala|pekoni|salami|chicken|kyckling|\bbeef|\bpork|salmon|lax\b|\blohi\b|kirjolohi|katkarap|\bkött|\bkorv\b|korvar\b/i, 'meat'],
  [/omena\b|banaani|peruna|tomaatti|kurkku\b|porkkana|hedelmä|vihannes|marja|frukt|mansikka|mansikoita|mustikka|vadelma\b|kukkakaali|parsakaali|pinaatti|salaatti\b|sipuli\b|paprika|avokado|appelsiini\b|sitruuna\b|päärynä\b|rypäle|kurpitsa|herne\b|maissi\b|sieni|champignon|tomato|strawberr|potato|carrot/i, 'produce'],
  [/juoma\b|juomat\b|mehu|kahvi\b|kahvia|papukahvi|suodatinkahvi|\btee\b|kivennäisvesi|limsa|\bolut\b|oluet|kaffe|dryck|energiajuoma|kaurajuoma|palautusjuoma|maitokahvi|pikakahvi/i, 'drinks'],
  [/pasta\b|makaroni|riisi\b|jauho|kastike|säilyke|mauste|ruokaöljy|rypsiöljy|oliiviöljy|kaurahiutale|mysli|muro|puuro|keitto\b|hernekeitto|proteiini|salaattikastike|jauhoseos/i, 'pantry'],
]
const NO_FOOD = new Set(['verkkokauppa', 'stockmann', 'yliopistonapteekki', 'apteekki360'])
const guess = (name: string, shop: string): CategoryId | undefined =>
  NONFOOD.find(([re]) => re.test(name))?.[1] ?? (NO_FOOD.has(shop) ? undefined : FOOD.find(([re]) => re.test(name))?.[1])
// When the name gives no clue, the kind of shop does.
const SHOP_DEFAULT: Record<string, CategoryId> = {
  verkkokauppa: 'electronics', yliopistonapteekki: 'health', apteekki360: 'health', ruohonjuuri: 'pantry',
  stockmann: 'health', karkkainen: 'home', halpahalli: 'home', prisma: 'home', lidl: 'home', tokmanni: 'household',
}
export const EMOJI: Record<CategoryId, string> = {
  dairy: '🥛', produce: '🥕', bread: '🍞', meat: '🥩', pantry: '🥫', drinks: '🧃', snacks: '🍫', household: '🧽',
  health: '🧴', pets: '🐾', home: '🏠', electronics: '🔌', toys: '🧸', clothing: '👕', office: '📚',
}

/**
 * Catalogue products whose source only said "pantry" (the catch-all) get a
 * better food category from their name when it is clear.
 */
export function refineCategory(name: string, category: CategoryId): CategoryId {
  if (category !== 'pantry') return category
  return FOOD.find(([re]) => re.test(name))?.[1] ?? category
}

/** Product pictures the shops show, by barcode (fallback for catalogue products without one). */
export async function shopImages(file: string): Promise<[string, string][]> {
  const d = await load(file)
  if (!d) return []
  return d.prices.filter((p) => p.image && /^https:\/\//.test(p.image)).map((p) => [p.ean, p.image!])
}

/** Products a shop sells that aren't in the catalogue, built from the shop's own data. */
export async function collectedProducts(file: string): Promise<Product[]> {
  const d = await load(file)
  if (!d) return []
  return d.prices.filter((p) => p.name).map((p) => {
    const category = guess(p.name!, d.retailerId) ?? SHOP_DEFAULT[d.retailerId] ?? 'household'
    return {
      id: `off:${p.ean}`, ean: p.ean, name: p.name!, brand: p.brand ?? '', category,
      // Shops rarely give the size separately, but it is usually in the name ("400 g", "6 x 0,33 l").
      size: parseQuantity(p.name), emoji: EMOJI[category],
      imageUrl: p.image && /^https:\/\//.test(p.image) ? p.image : undefined,
    }
  })
}

export function collectedProvider(file: string, id: string): PriceProvider {
  const source: PriceSource = id === 'tokmanni' ? 'tokmanni' : 'shop'
  let data: Promise<File | null> | null = null
  let history: Promise<Record<string, [string, number][]>> | null = null
  return {
    id: source,
    label: file,
    isSample: false,
    async getObservations(): Promise<PriceObservation[]> {
      data ??= load(file)
      const d = await data
      if (!d) return []
      history ??= fetchData<Record<string, [string, number][]>>(file.replace('.json', '-history.json')).then((h) => h ?? {})
      // Earlier prices (one point per change), so history and price drops work.
      const past = Object.entries(await history).flatMap(([ean, points]) =>
        points
          .filter(([day]) => day < d.fetchedAt.slice(0, 10))
          .map(([day, cents]) => ({
            productId: `off:${ean}`, retailerId: d.retailerId, priceCents: cents,
            observedAt: `${day}T06:00:00.000Z`, source,
          })),
      )
      return [...past, ...d.prices.map((p) => ({
        productId: `off:${p.ean}`,
        retailerId: d.retailerId,
        priceCents: p.priceCents,
        // When this price was last checked on the store's site.
        observedAt: p.checkedAt ?? d.fetchedAt,
        source,
        url: p.url && /^https:\/\//.test(p.url) ? p.url : undefined,
      }))]
    },
  }
}
