// Where a product picture comes from, read from its address: a shop's own site
// (or the image service it uses), or Open Food Facts. Shown under the picture.
const BY_HOST: [RegExp, string][] = [
  [/openfoodfacts\.(org|net)/, 'off'],
  [/res\.cloudinary\.com\/tokmanni\//, 'tokmanni'],
  [/(^|\.)stockmann\.com/, 'stockmann'],
  [/(^|\.)s-cloud\.fi/, 'prisma'],
  [/(^|\.)power-cdn\.net/, 'power'],
  [/(^|\.)verkcdn\.com/, 'verkkokauppa'],
  [/(^|\.)jimms\.fi/, 'jimms'],
  [/(^|\.)karkkainen\.com/, 'karkkainen'],
  [/(^|\.)lidl\.[a-z]+/, 'lidl'],
  [/(^|\.)halpahalli\.fi/, 'halpahalli'],
  [/(^|\.)minimani\.fi/, 'minimani'],
  [/(^|\.)multitronic\.fi/, 'multitronic'],
  [/(^|\.)ruohonjuuri\.fi/, 'ruohonjuuri'],
  [/(^|\.)yliopistonapteekki\.fi/, 'yliopistonapteekki'],
  [/(^|\.)apteekki360\.fi/, 'apteekki360'],
  [/(^|\.)tokmanni\.fi/, 'tokmanni'],
]

/** 'off' for Open Food Facts, a retailer id, or undefined when unknown. */
export function imageSource(url: string | undefined): string | undefined {
  if (!url) return undefined
  const rest = url.replace(/^https?:\/\//, '')
  return BY_HOST.find(([re]) => re.test(rest))?.[1]
}
