// Product categories for shop products, guessed from the product name (and
// the kind of shop when the name gives no clue). Pure code: used by the app
// and by scripts/build-price-bundles.ts.
import type { CategoryId } from './types'

// Category guess from a Finnish/Swedish product name; the first match wins.
// Non-food words come first so "kissanruoka" is pet food and "puhdistusmaito"
// is skin care. Shops that sell no food never get a food category.
// Prisma lists books as "Surname, Title" (case matters: "Köynnösritilä, grafiitin harmaa" is no book).
const BOOK = /^[A-ZÅÄÖ][\wåäöéü'\-]+(?: [A-ZÅÄÖ][\wåäöéü'\-]+)?, [A-ZÅÄÖ0-9@][a-zåäöéü]/
// Food words that would otherwise be caught by a non-food word ("kahvikapselit" is not health).
const FOOD_FIRST: [RegExp, CategoryId][] = [
  [/kahvikapseli|kahvityyny|kahvipaketti|teepussi|dolce gusto|nespresso.*kapseli/i, 'drinks'],
]
const NONFOOD: [RegExp, CategoryId][] = [
  // Books are listed "Surname, Title" by Prisma; also calendars, paper and office supplies.
  [/kirja\b|romaani|kalenteri|muistikirja|vihko|kansio|mappi|\bA4\b|\bA5\b|\bA6\b|kartonki|tulostuspaperi|kopiopaperi|kirjekuori|kuulakärkikynä|lyijykynä|tussi|\bkynä\b|nitoja|teippi|post-it|muistilappu/i, 'office'],
  [/koira|kissa|kisso|koiri|\b(?:adult|senior|junior|kitten) \d\+|lemmik|jyrsijä|akvaario|kaneille|hevose|\bhund|\bkatt\b|kattmat|kattleksak|pururull|puruluu|purutikku|täysravinto|kuivaruoka|märkäruoka|herkkupal|mahalastu|päänahka|almo nature|friskies|whiskas|pedigree|royal canin|purina|taste of the wild|\bpuppy\b|\bkitten\b|\bdog\b|\bcat\b|riistaa|herkkutanko|\bmush\b|\bsoossi|mush snacks|viljaton|riista-riisi|kana-riisi|makkaratikku|\bvet\b/i, 'pets'],
  [/lelu|lego|nukke|leikattavat|palapeli|lautapeli|seurapeli|partypeli|korttipeli|\bpeli\b|palikat|palikoista|rakennussarja|pehmo|leikki|playmobil|barbie|hot wheels|figuuri|leksak|funko|sylvanian|brio\b|schleich|kilpa-auto|pienoismalli|squishmallow/i, 'toys'],
  [/puhelin|kuuloke|kuulok|kaiutin|televisio|\btv\b|kannettava|tietokone|näyttö|laturi|kaapeli|\busb|hdmi|bluetooth|kamera|konsoli|playstation|xbox|nintendo|ipad|iphone|galaxy|hiiri\b|näppäimistö|reititin|muistikortti|\bssd\b|älykello|powerbank|virtapankki|tulostin|projektori|mikrofoni|mustekasetti|värikasetti|levysoitin/i, 'electronics'],
  // Kitchen tools and appliances before food words ("juustohöylä", "perunasurvin").
  [/höylä|survin|leikkuri|puristin|lautanen|lautasliina|tuoppi|letku|vesiautomaatti|höyrystin|kulho|vuoka|lyhty|ilmanraikastin|pesukone|kuivausrumpu|jääkaappi|pakastin|mikroaaltouuni|imuri|vedenkeitin|kahvinkeitin|leipäkone|tehosekoitin|airfryer|koriste|tarra|glitter|timanttimaalaus|lanka\b|\bwool\b|saippua-alusta|saippuapullo|hammasharjateline|annostelija|kynttilä|lasilyhty/i, 'home'],
  [/shampoo|hoitoaine|voide|poretabletti|bcaa|nail polish|kreatiini|ravintolisä|elektrolyytti|lifter|\bgloss\b|huulten|rajauskynä|maybelline|l'or[eé]al|garnier|nivea|rimmel|max factor|catrice|essence\b|vitamiini|tabletit|kapseli|hammastahna|hammasharja|deodorantti|antiperspirant|meikki|meikin|makeup|make up|luomiväri|paletti|ripsiväri|huuli|kynsilakka|lakka\b|parfyymi|hajuvesi|eau de|tuoksu|ihon|aurinkosuoja|laastari|kosteus|seerumi|serum|suihkusaippua|saippua|partak|kasvo|\bface\b|hius|kynsi|lääke|särky|nenäsumute|silmätipat|probiootti|omega|magnesium|kalsium|puhdistusmaito|puhdistusöljy|cleans|cream|lotion|balsami|kosmetiikka|ripsi|kulmakynä|sidos\b|vaippa/i, 'health'],
  [/pesuaine|puhdistusaine|desinfi|huuhtelutiiviste|wc-puhdist|siivous|tiskiaine|pyykin|pesujauhe|pesuneste|roskapussi|talouspaperi|wc-paperi|huuhteluaine|tahranpoist|astianpesuaine|lattiasiivous/i, 'household'],
  [/paita\b|paita,|t-paita|housut|takki\b|takki,|mekko|hame\b|sukat|sukkahousut|kengät|saappaat|pipo|hanskat|lapaset|farkut|alushousut|rintaliivit|huppari|neule\b|neuletakki|villapaita|pyjama|uimapuku|bokserit|huivi|koru\b|korvakoru|kaulakoru|rannekoru|sormus/i, 'clothing'],
  [/lamppu|valaisin|matto|tyyny|peitto|lakana|pyyhe|verho|kattila|paistinpannu|pannu\b|astia|muki|lasi\b|lasit\b|juomalasi|veitsi|työkalu|ruuvi|porakone|puutarha|ruukku|tuoli|pöytä|hylly|säilytys|laatikko|kori\b|sisustus|teline|sakset|vasara|maali\b|liima|grilli|savustus|jatkojohto|paristo|keitin|kone\b|blender|termos|pullo\b|juomapullo|henkari|purkki|kansi\b|pesusieni|kukkasieni|keraaminen|ilmapallo|nelson garden|kylvö|\bsiemen\b|siemenet|novita|\blanka|taulu\b|lasikurpitsa|kauha\b|kauha |veitset|haarukka|lusikka|lasintunnist|rengas\b|kesärengas|talvirengas|sokerimassa(?=.*koriste)/i, 'home'],
]
// Order matters: what the product is (drink, sweet, soup) before what it tastes of
// ("mansikka mehujuoma" is a drink, "juustokeitto" a soup); fruit and veg last.
const FOOD: [RegExp, CategoryId][] = [
  [/juoma\b|juomat\b|mehu|nektari|kahvi\b|kahvia|papukahvi|suodatinkahvi|\btee\b|kivennäisvesi|\bvesi\b|lähdevesi|limsa|virvoitus|\bcola\b|smoothie|\bolut\b|oluet|siideri|lonkero|kaffe|dryck|energiajuoma|kaurajuoma|palautusjuoma|maitokahvi|pikakahvi|makutiiviste|mehutiiviste|kaakao\b(?!.*(?:granola|mysli|murot|jauhe))|kaakaojuoma/i, 'drinks'],
  [/suklaa|karkki|makeis|salmiakki|\bgum\b|purukumi|salaattisekoitus|sipsi|keksi|choklad|godis|chips|pastilli|purukumi|konvehti|snacks|suolakeksi|maissikakku|riisikakku|lakritsi|lakupala|toffee|karamelli|marmeladi|tikkari|popcorn|naksu|välipalapatukka|patukka|vohveli|pikkuleipä|jäätelö|pähkinä|manteli|cashew|pistaasi|maapähkinä|rusina|kuivattu|proteiinikakku/i, 'snacks'],
  [/keitto\b|keitto,|soppa|valmisruoka|ateria|lasagne|pizza|pasta\b|makaroni|spagetti|spaghetti|survos|inkivääri|nuudeli|riisi\b|jauho|jauhoseos|kastike|säilyke|mauste|ruokaöljy|rypsiöljy|oliiviöljy|öljyspray|kaurahiutale|hiutaleet|mysli|granola|muro|murot|puuro|proteiinijauhe|heraproteiini|proteiini|salaattikastike|sokeri\b|sokerimassa|\bsuola\b|pippuri|ketsuppi|sinappi|majoneesi|hillo|hunaja|siirappi|etikka|pesto|liemi|fondi|leivinjauhe|hiiva|vanilja|leivonta|kakkuseos|tomaattimurska|sose\b|rouhe\b|siemenrouhe|hedelmäsose|pavut|papuja|linssi|kikherne|kookosmaito|soijakastike|chili|curry|taco|salsa|nacho|tortillalastu/i, 'pantry'],
  [/maito\b|maitoa|maitojuoma|maito |juusto|jogurtti|skyr|kefiiri|kuohukerma|ruokakerma|vispikerma|kerma\b|smetana|kermaviili|creme fraiche|ranskankerma|\bvoi\b|margariini|levite|rahka|viili|vanukas|kananmun|munat\b|mjölk|\bost\b/i, 'dairy'],
  [/leipä\b|leipää|leipä,|leivät|sämpylä|näkki|korppu|\bbröd|pulla\b|pullava|paahto|patonki|ruisrieska|rieska|tortilla|piirakka|croissant|munkki\b|sämpyl|bagel|ciabatta|focaccia|leipäjuusto/i, 'bread'],
  [/makkara|nakki|nakit|kinkku|broiler|kanafile|fileesuikale|kananpoika|kanan |\bkana\b|kalkkuna|jauheliha|silava|lihapulla|lihapyörykkä|leikkele|kebab|pihvi|naudan|porsaan|possun|wienerleike|lohifile|kalapuikko|tonnikala|silli|makrilli|sardiini|katkarap|pekoni|salami|chicken|kyckling|\bbeef|\bpork|salmon|\blax\b|\blohi\b|kirjolohi|\bkött|\bkorv\b|korvar\b/i, 'meat'],
  [/omena\b|banaani|peruna\b|perunat|tomaatti\b|tomaatit|kurkku\b|porkkana|hedelmä|vihannes|marja|frukt|mansikka|mansikoita|mustikka|vadelma\b|kukkakaali|parsakaali|pinaatti|salaatti\b|sipuli\b|paprika|avokado|appelsiini\b|sitruuna\b|päärynä\b|rypäle|kurpitsa|herne\b|maissi\b|herkkusien|\bsienet\b|kantarelli|champignon|tomato|strawberr|potato|carrot/i, 'produce'],
]
const NO_FOOD = new Set(['verkkokauppa', 'stockmann', 'yliopistonapteekki', 'apteekki360', 'power', 'multitronic', 'jimms'])
export const guess = (name: string, shop: string): CategoryId | undefined => {
  if (shop === 'prisma' && BOOK.test(name)) return 'office'
  if (!NO_FOOD.has(shop)) { const f = FOOD_FIRST.find(([re]) => re.test(name)); if (f) return f[1] }
  const nonFood = NONFOOD.find(([re]) => re.test(name))?.[1]
  if (nonFood || NO_FOOD.has(shop)) return nonFood
  // A bare model number at the end ("Metsän sienet 11505", a puzzle) is never food.
  if (/\s\d{5}$/.test(name)) return undefined
  return FOOD.find(([re]) => re.test(name))?.[1]
}
// When the name gives no clue, the kind of shop does.
export const SHOP_DEFAULT: Record<string, CategoryId> = {
  verkkokauppa: 'electronics', minimani: 'home', power: 'electronics', multitronic: 'electronics', jimms: 'electronics', yliopistonapteekki: 'health', apteekki360: 'health', ruohonjuuri: 'pantry',
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
