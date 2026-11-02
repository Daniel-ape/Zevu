import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ChainId, PriceObservation, PriceProvider, Product, Retailer, ShoppingList } from '../domain/types'
import { LOYALTY_PROGRAMS, RETAILERS } from './retailers'
import { detectLang, translate, type Key, type Lang } from '../i18n'
import { receiptObservations, type Receipt } from '../domain/receipts'
import { lookupBarcode, searchProducts } from './openFoodFacts'
import { loadSnapshot, snapshotProducts } from './snapshot'

// Registered price providers. Prices currently come only from receipts users
// import; store connectors are added here when a permitted source exists.
// The UI only ever sees PriceObservations.
const PROVIDERS: PriceProvider[] = []

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('hintaopas:' + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem('hintaopas:' + key, JSON.stringify(value))
  } catch {
    /* storage unavailable: keep state in memory only */
  }
}

const DEFAULT_LIST: ShoppingList = { id: 'weekly', name: 'Weekly shop', items: [] }

export type Theme = 'system' | 'light' | 'dark'

interface Store {
  products: Product[]
  retailers: Retailer[]
  observations: PriceObservation[]
  loading: boolean
  list: ShoppingList
  setQuantity: (productId: string, qty: number) => void
  /** Barcode lookup: local catalogue first, then Open Food Facts. 'unavailable' = service unreachable. */
  findByBarcode: (ean: string) => Promise<Product | null | 'unavailable'>
  /** Product search in Open Food Facts; 'unavailable' when unreachable. */
  searchOnline: (q: string) => Promise<Product[] | 'unavailable'>
  /** Prices the user added by hand or from a shelf label. */
  addPrice: (o: { productId: string; retailerId: string; priceCents: number; origin: 'manual' | 'shelf' }) => void
  lastStore: string | null
  receipts: Receipt[]
  addReceipt: (r: Receipt) => void
  removeReceipt: (id: string) => void
  recent: string[]
  markViewed: (productId: string) => void
  theme: Theme
  setTheme: (t: Theme) => void
  memberships: ChainId[]
  toggleMembership: (c: ChainId) => void
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
  programs: typeof LOYALTY_PROGRAMS
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [observations, setObservations] = useState<PriceObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<ShoppingList>(() => {
    const saved = load('list', DEFAULT_LIST)
    // Lists saved by earlier versions may hold demo products (ids p1…p18).
    return { ...saved, items: saved.items.filter((i) => !/^p\d+$/.test(i.productId)) }
  })
  const [receipts, setReceipts] = useState<Receipt[]>(() => load('receipts', []))
  const [userPrices, setUserPrices] = useState<PriceObservation[]>(() => load('userPrices', []))
  const [lastStore, setLastStore] = useState<string | null>(() => load('lastStore', null))
  // Products fetched from Open Food Facts, kept so they work offline later.
  const [remote, setRemote] = useState<Product[]>(() => load('remoteProducts', []))
  const remember = (list: Product[]) =>
    setRemote((cur) => {
      const byId = new Map(cur.map((p) => [p.id, p]))
      list.forEach((p) => byId.set(p.id, p))
      return [...byId.values()].slice(-300)
    })
  const [recent, setRecent] = useState<string[]>(() => load<string[]>('recent', []).filter((id) => !/^p\d+$/.test(id)))
  const [theme, setTheme] = useState<Theme>(() => load('theme', 'system'))
  const [memberships, setMemberships] = useState<ChainId[]>(() => load('memberships', []))
  const [lang, setLang] = useState<Lang>(() => load('lang', detectLang()))
  // Real products sold in Finland, bundled with the app (Open Food Facts).
  const [snapshotRows, setSnapshotRows] = useState<Awaited<ReturnType<typeof loadSnapshot>>>([])
  useEffect(() => { loadSnapshot().then(setSnapshotRows) }, [])
  const products = useMemo(() => {
    const seen = new Set<string>()
    const all = [...snapshotProducts(snapshotRows, lang), ...remote]
    return all.filter((p) => (seen.has(p.ean) ? false : (seen.add(p.ean), true)))
  }, [remote, snapshotRows, lang])

  useEffect(() => {
    Promise.all(PROVIDERS.map((p) => p.getObservations([]).catch(() => [])))
      .then((all) => setObservations(all.flat()))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => save('list', list), [list])
  useEffect(() => save('receipts', receipts), [receipts])
  useEffect(() => save('userPrices', userPrices), [userPrices])
  useEffect(() => save('lastStore', lastStore), [lastStore])
  useEffect(() => save('remoteProducts', remote), [remote])
  useEffect(() => save('recent', recent), [recent])
  useEffect(() => save('memberships', memberships), [memberships])
  useEffect(() => {
    save('lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  // Apply member prices for the cards the user has. Everything downstream
  // (comparisons, baskets, history) just sees the price this user would pay.
  const effective = useMemo(() => {
    const chainOf = new Map(RETAILERS.map((r) => [r.id, r.chain]))
    const provider = memberships.length
      ? observations.map((o) =>
          o.memberPriceCents && memberships.includes(chainOf.get(o.retailerId)!)
            ? { ...o, priceCents: o.memberPriceCents, isMemberPrice: true }
            : o,
        )
      : observations
    // Prices the user actually paid, from imported receipts.
    return [...provider, ...receiptObservations(receipts), ...userPrices]
  }, [observations, memberships, receipts, userPrices])
  useEffect(() => {
    save('theme', theme)
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  const value = useMemo<Store>(
    () => ({
      products,
      findByBarcode: async (ean) => {
        const local = products.find((p) => p.ean === ean)
        if (local) return local
        try {
          const p = await lookupBarcode(ean, lang)
          if (p) remember([p])
          return p
        } catch {
          return 'unavailable'
        }
      },
      searchOnline: async (q) => {
        try {
          const found = await searchProducts(q, lang)
          remember(found)
          return found
        } catch {
          return 'unavailable'
        }
      },
      retailers: RETAILERS,
      observations: effective,
      loading,
      list,
      setQuantity: (productId, qty) =>
        setList((l) => {
          const items = l.items.filter((i) => i.productId !== productId)
          if (qty > 0) {
            const idx = l.items.findIndex((i) => i.productId === productId)
            const next = { productId, quantity: qty }
            if (idx === -1) items.push(next)
            else items.splice(idx, 0, next)
          }
          return { ...l, items }
        }),
      addPrice: ({ productId, retailerId, priceCents, origin }) => {
        setUserPrices((all) => [...all, { productId, retailerId, priceCents, origin, source: 'user-report', observedAt: new Date().toISOString() }])
        setLastStore(retailerId)
      },
      lastStore,
      receipts,
      addReceipt: (r) => setReceipts((all) => [r, ...all]),
      removeReceipt: (id) => setReceipts((all) => all.filter((r) => r.id !== id)),
      recent,
      markViewed: (id) => setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 8)),
      theme,
      setTheme,
      memberships,
      toggleMembership: (c) => setMemberships((m) => (m.includes(c) ? m.filter((x) => x !== c) : [...m, c])),
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      programs: LOYALTY_PROGRAMS,
    }),
    [effective, products, loading, list, receipts, recent, theme, memberships, lang, lastStore],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
