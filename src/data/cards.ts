// Loyalty cards the user adds to the app (stored only on the phone), and
// which shops each programme covers, so offers can be matched to them.
export interface LoyaltyCard {
  id: string
  chain: string // id in CARD_CHAINS
  name?: string // for "other" cards
  number: string
  format: string // ZXing format name, e.g. CODE_128, EAN_13, QR_CODE
  added: string
}

export interface CardChain {
  id: string
  name: string
  color: string
  retailers: string[] // RETAILERS ids whose prices count as this programme's
  leaflets?: string // leaflet shelf name (screens/Leaflets.tsx)
}

export const CARD_CHAINS: CardChain[] = [
  { id: 's', name: 'S-Etukortti', color: '#00804b', retailers: ['prisma', 's-market', 'sale', 'alepa'] },
  { id: 'k', name: 'K-Plussa', color: '#ef6c00', retailers: ['k-citymarket', 'k-supermarket', 'k-market'], leaflets: 'K-Ruoka' },
  { id: 'lidl', name: 'Lidl Plus', color: '#0050aa', retailers: ['lidl'], leaflets: 'Lidl' },
  { id: 'tokmanni', name: 'Tokmanni', color: '#d4142a', retailers: ['tokmanni'], leaflets: 'Tokmanni' },
  { id: 'halpahalli', name: 'Halpa-Halli', color: '#b5121b', retailers: ['halpahalli'], leaflets: 'Halpa-Halli' },
  { id: 'minimani', name: 'Minimani', color: '#d2481a', retailers: [], leaflets: 'Minimani' },
  { id: 'rusta', name: 'Rusta', color: '#23794b', retailers: [], leaflets: 'Rusta' },
  { id: 'karkkainen', name: 'Kärkkäinen', color: '#e2001a', retailers: ['karkkainen'] },
  { id: 'stockmann', name: 'Stockmann', color: '#1d1d1b', retailers: ['stockmann'] },
  { id: 'other', name: '', color: '#6b6b78', retailers: [] },
]

export const chainOf = (c: LoyaltyCard) => CARD_CHAINS.find((x) => x.id === c.chain) ?? CARD_CHAINS[CARD_CHAINS.length - 1]
export const cardName = (c: LoyaltyCard) => (c.chain === 'other' ? c.name || '—' : chainOf(c).name)

/** Format to draw a typed-in number with: a valid EAN as EAN-13, otherwise Code 128. */
export function guessFormat(number: string): string {
  if (/^\d{13}$/.test(number)) {
    const d = number.split('').map(Number)
    const check = d.pop()!
    const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0)
    if ((10 - (sum % 10)) % 10 === check) return 'EAN_13'
  }
  return 'CODE_128'
}
