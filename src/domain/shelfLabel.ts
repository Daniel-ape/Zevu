// Picks the shelf price from the words read off a shelf-label photo.
// Finnish shelf labels print the price largest; the unit price (€/kg, €/l)
// is small. Prices may be "2,49", "2.49" or a big "2" followed by a small "49".

export interface LabelWord { text: string; height: number; line: string }

const UNIT = /\/\s*(kg|l|kpl|st|pcs)\b|€\s*\/|\bkg\b.*€|jäsenhinta|ilman/i

export function pickShelfPrice(words: LabelWord[]): number | null {
  const candidates: { cents: number; height: number }[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const clean = w.text.replace(/[€eE]$/, '').replace(/^[^0-9]+/, '')
    let cents: number | null = null
    let height = w.height
    const m = clean.match(/^(\d{1,3})[,.](\d{2})$/)
    if (m) cents = +m[1] * 100 + +m[2]
    else if (/^\d{1,2}$/.test(clean) && words[i + 1] && /^\d{2}$/.test(words[i + 1].text) && words[i + 1].line === w.line) {
      cents = +clean * 100 + +words[i + 1].text // big euros, small cents
      height = Math.max(w.height, words[i + 1].height)
    }
    if (cents === null || cents <= 0 || cents > 50000) continue
    if (UNIT.test(w.line)) height *= 0.5 // unit prices are never the shelf price
    candidates.push({ cents, height })
  }
  // Only trust a price printed clearly bigger than the rest of the label;
  // a wrong price filled in is worse than an empty field.
  const heights = words.map((w) => w.height).sort((a, b) => a - b)
  const median = heights[Math.floor(heights.length / 2)] ?? 0
  candidates.sort((a, b) => b.height - a.height)
  const best = candidates[0]
  return best && best.height >= median * 1.8 ? best.cents : null
}
