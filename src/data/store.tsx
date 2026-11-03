import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CategoryId, PriceObservation, PriceProvider, Product, Retailer, ShoppingList, Watch } from '../domain/types'
import { RETAILERS } from './retailers'
import { detectLang, translate, type Key, type Lang } from '../i18n'
import { receiptObservations, type Receipt } from '../domain/receipts'
import { lookupBarcode, searchProducts } from './openFoodFacts'
import { loadSnapshot, snapshotProducts } from './snapshot'
import { collectedProducts, collectedProvider, shopImages } from './collectedPrices'

// Registered price providers: prices collected from stores that allow it
// (Tokmanni, see collector/). Receipts and the user's own prices are added
// on top. The UI only ever sees PriceObservations.
// Prices collected daily from the shops' own sites (collector/*.mjs).
const SHOP_FILES: [string, string][] = [
  ['tokmanni.json', 'tokmanni'], ['halpahalli.json', 'halpahalli'], ['verkkokauppa.json', 'verkkokauppa'],
  ['prisma.json', 'prisma'], ['stockmann.json', 'stockmann'],
]
const PROVIDERS: PriceProvider[] = SHOP_FILES.map(([file, id]) => collectedProvider(file, id))

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
  /** Prices grouped by product, so screens don't scan every price per product. */
  pricesOf: (productId: string) => PriceObservation[]
  /** All stores the app knows; `retailers` is narrowed to the user's own stores. */
  allRetailers: Retailer[]
  myStores: string[]
  toggleMyStore: (id: string) => void
  /** The active shopping list, and all lists. */
  list: ShoppingList
  lists: ShoppingList[]
  setActiveList: (id: string) => void
  createList: (name: string) => void
  renameList: (id: string, name: string) => void
  deleteList: (id: string) => void
  restoreList: (l: ShoppingList) => void
  setQuantity: (productId: string, qty: number) => void
  toggleChecked: (productId: string) => void
  clearChecked: () => void
  watched: Watch[]
  toggleWatch: (productId: string, currentCents: number | null) => void
  /** Barcode lookup: local catalogue first, then Open Food Facts. 'unavailable' = service unreachable. */
  findByBarcode: (ean: string) => Promise<Product | null | 'unavailable'>
  /** A product the user names themselves when its barcode is unknown. */
  addOwnProduct: (o: { ean: string; name: string; category: CategoryId }) => Product
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
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [observations, setObservations] = useState<PriceObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState<ShoppingList[]>(() => {
    const saved = load<ShoppingList[] | null>('lists', null) ?? [load('list', DEFAULT_LIST)] // older versions had one list
    // Lists saved by earlier versions may hold demo products (ids p1…p18).
    return saved.map((l) => ({ ...l, items: l.items.filter((i) => !/^p\d+$/.test(i.productId)) }))
  })
  const [activeId, setActiveId] = useState<string>(() => load('activeList', lists[0]?.id ?? 'weekly'))
  const list = lists.find((l) => l.id === activeId) ?? lists[0]
  const updateActive = (fn: (l: ShoppingList) => ShoppingList) =>
    setLists((all) => all.map((l) => (l.id === list.id ? fn(l) : l)))
  const [myStores, setMyStores] = useState<string[]>(() => load('myStores', []))
  const [watched, setWatched] = useState<Watch[]>(() => load('watched', []))
  const [receipts, setReceipts] = useState<Receipt[]>(() => load('receipts', []))
  const [userPrices, setUserPrices] = useState<PriceObservation[]>(() => load('userPrices', []))
  const [lastStore, setLastStore] = useState<string | null>(() => load('lastStore', null))
  // Products fetched from Open Food Facts, kept so they work offline later.
  const [remote, setRemote] = useState<Product[]>(() => load('remoteProducts', []))
  const remember = (list: Product[]) =>
    setRemote((cur) => {
      const byId = new Map(cur.map((p) => [p.id, p]))
      list.forEach((p) => byId.set(p.id, p))
      // Products the user added themselves are always kept; lookups are a cache.
      const all = [...byId.values()]
      return [...all.filter((p) => p.infoSource === 'user'), ...all.filter((p) => p.infoSource !== 'user').slice(-300)]
    })
  const [recent, setRecent] = useState<string[]>(() => load<string[]>('recent', []).filter((id) => !/^p\d+$/.test(id)))
  const [theme, setTheme] = useState<Theme>(() => load('theme', 'system'))
  const [lang, setLang] = useState<Lang>(() => load('lang', detectLang()))
  // Real products sold in Finland, bundled with the app (Open Food Facts).
  const [snapshotRows, setSnapshotRows] = useState<Awaited<ReturnType<typeof loadSnapshot>>>([])
  useEffect(() => { loadSnapshot().then(setSnapshotRows) }, [])
  // Products shops sell that the catalogue doesn't have (named by the shop).
  const [shopProducts, setShopProducts] = useState<Product[]>([])
  const [shopPics, setShopPics] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    Promise.all(SHOP_FILES.map(([f]) => collectedProducts(f).catch(() => []))).then((all) => setShopProducts(all.flat()))
    Promise.all(SHOP_FILES.map(([f]) => shopImages(f).catch(() => []))).then((all) => setShopPics(new Map(all.flat())))
  }, [])
  const products = useMemo(() => {
    const seen = new Set<string>()
    const all = [...snapshotProducts(snapshotRows, lang), ...remote, ...shopProducts]
    return all
      .filter((p) => (seen.has(p.ean) ? false : (seen.add(p.ean), true)))
      // No picture in the catalogue: use the one a shop shows for the same barcode.
      .map((p) => (p.imageChunk === undefined && !p.imageUrl && shopPics.has(p.ean) ? { ...p, imageUrl: shopPics.get(p.ean) } : p))
  }, [remote, snapshotRows, lang, shopProducts, shopPics])

  useEffect(() => {
    Promise.all(PROVIDERS.map((p) => p.getObservations([]).catch(() => [])))
      .then((all) => setObservations(all.flat()))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => save('lists', lists), [lists])
  useEffect(() => save('activeList', activeId), [activeId])
  useEffect(() => save('myStores', myStores), [myStores])
  useEffect(() => save('watched', watched), [watched])
  useEffect(() => save('receipts', receipts), [receipts])
  useEffect(() => save('userPrices', userPrices), [userPrices])
  useEffect(() => save('lastStore', lastStore), [lastStore])
  useEffect(() => save('remoteProducts', remote), [remote])
  useEffect(() => save('recent', recent), [recent])
  useEffect(() => {
    save('lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  // Everything the user has seen themselves comes on top of collected prices.
  const effective = useMemo(
    () => [...observations, ...receiptObservations(receipts), ...userPrices],
    [observations, receipts, userPrices],
  )
  useEffect(() => {
    save('theme', theme)
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
  const byProduct = useMemo(() => {
    const m = new Map<string, PriceObservation[]>()
    for (const o of effective) {
      const list = m.get(o.productId)
      if (list) list.push(o)
      else m.set(o.productId, [o])
    }
    return m
  }, [effective])

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
      addOwnProduct: ({ ean, name, category }) => {
        const emoji: Record<CategoryId, string> = { dairy: '🥛', produce: '🥕', bread: '🍞', meat: '🥩', pantry: '🥫', drinks: '🧃', snacks: '🍫', household: '🧴' }
        const id = ean ? `off:${ean}` : `own:${name.trim().toLowerCase().replace(/[^a-z0-9åäö]+/g, '-')}`
        const p: Product = { id, ean, name: name.trim(), brand: '', category, size: { amount: 0, unit: 'pcs' }, emoji: emoji[category], infoSource: 'user' }
        remember([p])
        return p
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
      allRetailers: RETAILERS,
      retailers: myStores.length ? RETAILERS.filter((r) => myStores.includes(r.id)) : RETAILERS,
      myStores,
      toggleMyStore: (id) => setMyStores((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id])),
      observations: effective,
      pricesOf: (id: string) => byProduct.get(id) ?? [],
      loading,
      list,
      lists,
      setActiveList: setActiveId,
      createList: (name) => {
        const id = (crypto.randomUUID?.() ?? String(Date.now())).slice(0, 8)
        setLists((all) => [...all, { id, name, items: [] }])
        setActiveId(id)
      },
      renameList: (id, name) => setLists((all) => all.map((l) => (l.id === id ? { ...l, name } : l))),
      deleteList: (id) =>
        setLists((all) => {
          const rest = all.filter((l) => l.id !== id)
          const next = rest.length ? rest : [{ ...DEFAULT_LIST, id: 'weekly' }]
          if (id === activeId) setActiveId(next[0].id)
          return next
        }),
      restoreList: (l) => {
        setLists((all) => [...all.filter((x) => x.id !== l.id), l])
        setActiveId(l.id)
      },
      toggleChecked: (productId) =>
        updateActive((l) => ({ ...l, items: l.items.map((i) => (i.productId === productId ? { ...i, checked: !i.checked } : i)) })),
      clearChecked: () => updateActive((l) => ({ ...l, items: l.items.filter((i) => !i.checked) })),
      watched,
      toggleWatch: (productId, currentCents) =>
        setWatched((w) =>
          w.some((x) => x.productId === productId)
            ? w.filter((x) => x.productId !== productId)
            : [...w, { productId, baselineCents: currentCents, since: new Date().toISOString() }],
        ),
      setQuantity: (productId, qty) =>
        updateActive((l) => {
          const items = l.items.filter((i) => i.productId !== productId)
          if (qty > 0) {
            const idx = l.items.findIndex((i) => i.productId === productId)
            const next = { productId, quantity: qty }
            if (idx === -1) items.push(next)
            else items.splice(idx, 0, { ...l.items[idx], ...next })
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
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [effective, byProduct, products, loading, lists, list, activeId, myStores, watched, receipts, recent, theme, lang, lastStore],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
