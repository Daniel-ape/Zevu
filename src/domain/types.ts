// Core domain model.
// Product information and retailer pricing are deliberately separate:
// a Product describes *what* something is (identified by EAN), a
// PriceObservation records *what one retailer charged, when, according to
// which source*. Prices are never stored on the product itself.

export type ChainId = 's-group' | 'k-group' | 'lidl' | 'tokmanni'

export interface Retailer {
  id: string // e.g. "prisma", "k-citymarket"
  name: string
  chain: ChainId
}

export type SizeUnit = 'g' | 'ml' | 'pcs'

export interface Product {
  id: string
  ean: string
  name: string
  /** The name in the other language (Finnish or Swedish), used by search. */
  altName?: string
  brand: string
  category: CategoryId
  size: { amount: number; unit: SizeUnit }
  /** Fallback visual when there is no product image. */
  emoji: string
  imageUrl?: string
  /** Picture packed in the bundled snapshot (see data/snapshot.ts). */
  imageChunk?: number
  /** Where the product information came from. */
  infoSource?: 'sample' | 'open-food-facts' | 'user'
}

export type CategoryId =
  | 'dairy'
  | 'bread'
  | 'produce'
  | 'meat'
  | 'pantry'
  | 'drinks'
  | 'snacks'
  | 'household'

/** Where a price came from. 'sample' must always be shown as such in the UI. */
export type PriceSource = 'sample' | 'k-ruoka' | 's-kaupat' | 'tokmanni' | 'lidl-offers' | 'user-report'

export interface PriceObservation {
  productId: string
  retailerId: string
  /** Shelf price in euro cents, to avoid floating point errors. */
  priceCents: number
  observedAt: string // ISO timestamp
  source: PriceSource
  isPromotion?: boolean
  /** Price for loyalty-card members, when the source reports one. */
  memberPriceCents?: number
  /** For user reports: from a receipt, typed in, or read from a shelf label. */
  origin?: 'receipt' | 'manual' | 'shelf'
  /** Set by the app when memberPriceCents was applied for this user. */
  isMemberPrice?: boolean
}


/** A data provider returns observations; the app never invents prices. */
export interface PriceProvider {
  id: PriceSource
  label: string
  isSample: boolean
  getObservations(productIds: string[]): Promise<PriceObservation[]>
}

export interface ShoppingListItem {
  productId: string
  quantity: number
  /** Ticked off while shopping. */
  checked?: boolean
}

/** A product the user follows, with the lowest price when they started. */
export interface Watch {
  productId: string
  baselineCents: number | null
  since: string
}

export interface ShoppingList {
  id: string
  name: string
  items: ShoppingListItem[]
}
