// Does a shop's product address look like food? Used to read food pages
// first. Works on the address (slug), so letters are plain ASCII
// ("leipa", not "leipä") and words are joined with hyphens.

// Food words found inside compound words ("kasvisvalmisriisi", "bolognesekastike").
const FOOD = /suklaa|karkki|makeis|sipsi|keksi|pastilli|purukumi|konvehti|patukka|lakritsi|lakrit|marmeladi|toffee|karamelli|maito|juusto|jogurtti|kerma|rahka|viili|margariini|levite|leipa|sampyla|nakki|makkara|kinkku|leikkele|salami|pekoni|kalkkuna|broileri|tonnikala|sardiini|silli|makrilli|riisi|pasta|makaroni|spagetti|nuudeli|jauho|kastike|ketsuppi|sinappi|majoneesi|mauste|kaneli|pippuri|sokeri|hiutale|mysli|muro|puuro|granola|keitto|kahvi|kaakao|mehu|juoma|limsa|limonadi|smoothie|hillo|marmelaati|hunaja|pahkina|manteli|cashew|siemen|rusina|taateli|kuivattu|sailyke|pizza|ateria|valmisruoka|lihapulla|pyora|herne|papu|pavut|linssi|kikherne|maissi|tomaatti|oliivi|kurkku|vohveli|kakku|leivos|munkki|pulla|korppu|naksu|popcorn|valipala|energiajuoma|siirappi|liemi|fondi|salsa|pesto|tahini|hummus|sose|nektari|tortilla|nacho|kekseja|suolakeksi|riisikakku|maissikakku|jalkiruoka|vanukas|kiisseli|leivonta|leivinjauhe|hiiva|vanilja|kookos|chili|curry|soija|etikka|ruokaoljy|rypsioljy|oliivioljy|kalapuikko|kananmuna|tee-|-tee|teepussi|pussitee|irtotee/
// Words that make it something else, even with a weight in the name.
const NOT_FOOD = /shampoo|hoitoaine|voide|pesu|saippua|deodor|antiperspir|hammas|tabletti|kapseli|vitamiini|kissa|koira|lemmik|jyrsija|lintu|hevonen|hius|kasvo|meikki|ripsi|huuli|kynsi|tuoksu|parfyymi|kynttila|maali|liima|suodatin|oljynsuod|moottorioljy|voiteluoljy|lamppuoljy|sytytys|grillihiili|briketti|lannoite|multa|siemenet-kylvo|kylvosiemen|lintujen|talipallo|pesa|kalastus|uistin|syotti|leikki|lelu|askartelu|savi|muovailu|kastikekulho|kulho|kannu|muki|lasi|lautanen|vuoka|pannu|kattila|termos|pullo-|juomapullo|rasia|tiivio|pussi-sulkija|kahvinkeitin|kahvimylly|kahvikuppi|teekannu|vedenkeitin|kone|laite|sakset|veitsi|lusikka|haarukka|pyyhe|tyyny|matto|ilmanraikast|wc-|puhdist|siivous|huuhtelu|tiski/
// A size such as "-220-g-", "-6-x-25-g-", "-1-5-l-".
const SIZE = /-\d+(?:-\d+)?(?:-x-\d+(?:-\d+)?)?-(?:g|kg|ml|cl|dl|l)(?:-|$)/

/** 0 = food, 1 = may be food (has a weight or volume), 2 = probably not. */
export function foodRank(url) {
  const slug = decodeURIComponent(String(url).split('/').pop() ?? '').toLowerCase().replace(/\.html$/, '')
  if (NOT_FOOD.test(slug)) return 2
  if (FOOD.test(slug)) return 0
  return SIZE.test(slug) ? 1 : 2
}
