// Product categories for shop products, guessed from the product name (and
// the kind of shop when the name gives no clue). Pure code: used by the app
// and by scripts/build-price-bundles.ts.
import type { CategoryId } from './types'

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
const NO_FOOD = new Set(['verkkokauppa', 'stockmann', 'yliopistonapteekki', 'apteekki360', 'power'])
export const guess = (name: string, shop: string): CategoryId | undefined =>
  NONFOOD.find(([re]) => re.test(name))?.[1] ?? (NO_FOOD.has(shop) ? undefined : FOOD.find(([re]) => re.test(name))?.[1])
// When the name gives no clue, the kind of shop does.
export const SHOP_DEFAULT: Record<string, CategoryId> = {
  verkkokauppa: 'electronics', power: 'electronics', yliopistonapteekki: 'health', apteekki360: 'health', ruohonjuuri: 'pantry',
  stockmann: 'health', karkkainen: 'home', halpahalli: 'home', prisma: 'home', lidl: 'home', tokmanni: 'home',
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


/** The category a shop product ends up in. */
export function categoryFor(name: string, shop: string): CategoryId {
  return guess(name, shop) ?? SHOP_DEFAULT[shop] ?? 'household'
}

/** What people buy week to week: loaded when the app starts. */
export const EVERYDAY = new Set<CategoryId>(['dairy', 'bread', 'produce', 'meat', 'pantry', 'drinks', 'snacks', 'household', 'health', 'pets'])
