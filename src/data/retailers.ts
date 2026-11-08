// Finnish grocery chains and shops the app knows about. Prices for Prisma also
// come from the Prisma.fi web shop (collector/stores.mjs).
import type { Retailer } from '../domain/types'

export const RETAILERS: Retailer[] = [
  { id: 'prisma', name: 'Prisma', chain: 's-group' },
  { id: 's-market', name: 'S-market', chain: 's-group' },
  { id: 'k-citymarket', name: 'K-Citymarket', chain: 'k-group' },
  { id: 'k-market', name: 'K-Market', chain: 'k-group' },
  { id: 'k-supermarket', name: 'K-Supermarket', chain: 'k-group' },
  { id: 'sale', name: 'Sale', chain: 's-group' },
  { id: 'alepa', name: 'Alepa', chain: 's-group' },
  { id: 'lidl', name: 'Lidl', chain: 'lidl' },
  { id: 'tokmanni', name: 'Tokmanni', chain: 'tokmanni' },
  { id: 'halpahalli', name: 'Halpa-Halli', chain: 'halpahalli' },
  { id: 'verkkokauppa', name: 'Verkkokauppa.com', chain: 'verkkokauppa' },
  { id: 'stockmann', name: 'Stockmann', chain: 'stockmann' },
  { id: 'karkkainen', name: 'Kärkkäinen', chain: 'karkkainen' },
  { id: 'ruohonjuuri', name: 'Ruohonjuuri', chain: 'ruohonjuuri' },
  { id: 'apteekki360', name: 'Apteekki360', chain: 'apteekki360' },
  { id: 'yliopistonapteekki', name: 'Yliopiston Apteekki', chain: 'yliopistonapteekki' },
  { id: 'power', name: 'Power', chain: 'power' },
  { id: 'multitronic', name: 'Multitronic', chain: 'multitronic' },
]
