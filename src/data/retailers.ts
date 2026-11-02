// Finnish grocery chains and their stores the app knows about.
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
]
