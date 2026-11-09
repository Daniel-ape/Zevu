import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { transition } from './viewTransition'
import { Welcome } from './screens/Welcome'
import { onSession, startAutoSync } from './data/account'
import { StoreProvider, useStore } from './data/store'
import type { CategoryId } from './domain/types'
import { NavCtx, type Nav, type Tab } from './nav'
import { Bag, Home as HomeIcon, List, Paper, Scan as ScanIcon } from './ui/icons'
import { Home } from './screens/Home'
import { SearchScreen } from './screens/SearchScreen'
import { ProductScreen } from './screens/ProductScreen'
import { Lists } from './screens/Lists'
import { Scan } from './screens/Scan'
import { Profile } from './screens/Profile'
import { Leaflets } from './screens/Leaflets'
import { Coupons } from './screens/Coupons'
import { useNewLeaflets } from './data/leafletFeed'
import { usePriceAlerts } from './data/priceAlerts'
import { autoLocate } from './data/nearby'
import { useLiquidGlass } from './ui/LiquidGlass'
import { WatchToast } from './ui/WatchBell'
import { DOCK_ICONS, NativeDock, wantsNativeDock } from './native/nativeDock'

const TABS: Tab[] = ['home', 'search', 'scan', 'lists', 'leaflets', 'profile', 'coupons']
const fromHash = (): Tab => {
  const h = location.hash.slice(1) as Tab
  return TABS.includes(h) ? h : 'home'
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { t } = useStore()
  const newLeaflets = useNewLeaflets()
  usePriceAlerts()
  // Follow the user's area: nearest stores' leaflets update when the app opens.
  useEffect(() => {
    autoLocate()
    const onShow = () => { if (document.visibilityState === 'visible') autoLocate() }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])
  const [tab, setTab] = useState<Tab>(fromHash)
  // First start: a welcome page with Google sign-in (shown once per device).
  const [welcomed, setWelcomed] = useState(() => { try { return localStorage.getItem('hintaopas:welcomed') === '1' } catch { return true } })
  const finishWelcome = () => { try { localStorage.setItem('hintaopas:welcomed', '1') } catch { /* private mode */ } setWelcomed(true) }
  // Signed in: keep lists, cards, coupons… in sync; reload when newer data arrived from another device.
  useEffect(() => {
    let stopSync = () => {}
    const stop = onSession((s) => {
      stopSync()
      stopSync = s ? startAutoSync(() => location.reload()) : () => {}
      if (s) finishWelcome()
    })
    return () => { stop(); stopSync() }
  }, [])
  const barRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLButtonElement>(null)
  const barGlass = useLiquidGlass('lg-bar', barRef)
  const scanGlass = useLiquidGlass('lg-scan', scanRef, { bezel: 14, scale: 22 })
  // iPhone app: Apple's own Liquid Glass tab bar (native). Falls back to the web dock if it fails.
  const [nativeDock, setNativeDock] = useState(wantsNativeDock)
  const [stack, setStack] = useState<string[]>([]) // product ids opened on top of the tab
  const scrolls = useRef(new Map<string, number>())
  const keyRef = useRef<string>('home')
  const stackLen = useRef(0)
  const remember = () => scrolls.current.set(keyRef.current, window.scrollY)
  const [searchCategory, setSearchCategory] = useState<CategoryId | 'all'>('all')
  const [searchFocus, setSearchFocus] = useState(false)

  useEffect(() => {
    const onHash = () => { setTab(fromHash()); setStack([]) }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const nav = useMemo<Nav>(
    () => ({
      tab,
      go: (t, opts) => {
        const order: Tab[] = ['home', 'search', 'lists', 'leaflets', 'profile', 'coupons', 'scan']
        const kind = t === tab ? 'fade' : order.indexOf(t) >= order.indexOf(tab) ? 'right' : 'left'
        remember()
        transition(kind, () => {
          setStack([])
          setSearchFocus(!!opts?.focus)
          if (t === 'search') setSearchCategory(opts?.category ?? 'all')
          setTab(t)
        })
        try { history.replaceState(null, '', '#' + t) } catch { /* sandboxed */ }
      },
      openProduct: (id) => { remember(); scrolls.current.delete('p' + (stackLen.current + 1)); transition('push', () => setStack((s) => [...s, id])) },
      back: () => { scrolls.current.delete(keyRef.current); transition('pop', () => setStack((s) => s.slice(0, -1))) },
      searchCategory,
      searchFocus,
    }),
    [tab, searchCategory, searchFocus],
  )

  const top = stack[stack.length - 1]
  const goRef = useRef(nav.go)
  goRef.current = nav.go
  useEffect(() => {
    if (!nativeDock) return
    const h = NativeDock.addListener('tap', (e) => goRef.current(e.id as Tab))
    return () => { h.then((x) => x.remove()).catch(() => {}) }
  }, [nativeDock])
  // Sheets and full-screen views (camera, card, shopping mode) are drawn by the page,
  // but the app's native dock floats above everything: hide it while one is open.
  const [overlay, setOverlay] = useState(false)
  useEffect(() => {
    if (!nativeDock) return
    // #splash is the start animation (index.html): the dock waits until it fades out.
    const SEL = '.sheet-backdrop, .shop, .cardview, .camera, .welcome, #splash:not(.out)'
    const check = () => setOverlay(!!document.querySelector(SEL))
    const mo = new MutationObserver(check)
    mo.observe(document.body, { childList: true, subtree: true })
    const splash = document.getElementById('splash')
    if (splash) mo.observe(splash, { attributes: true, attributeFilter: ['class'] })
    check()
    return () => mo.disconnect()
  }, [nativeDock])
  useEffect(() => {
    if (!nativeDock) return
    // The welcome page covers the whole screen too, with its own buttons at the bottom.
    if (overlay || !welcomed) { NativeDock.hide().catch(() => {}); return }
    // You is opened from the picture in the top corner of Home, not from the dock.
    const ids: Tab[] = ['home', 'search', 'lists', 'leaflets']
    const label = { home: 'tab.home', search: 'tab.search', lists: 'tab.list', leaflets: 'tab.leaflets' } as const
    NativeDock.show({
      tabs: ids.map((id) => ({ id, label: t(label[id as keyof typeof label]), icon: DOCK_ICONS[id] })),
      selected: top ? '' : tab,
      badges: newLeaflets && tab !== 'leaflets' ? ['leaflets'] : [],
      scanLabel: t('tab.scan'),
    }).catch(() => setNativeDock(false))
  }, [nativeDock, tab, top, newLeaflets, t, overlay, welcomed])
  // Each page keeps its scroll place: a new product page starts at the top,
  // going back or returning to a tab puts you where you were.
  const pageKey = top ? 'p' + stack.length : tab
  keyRef.current = pageKey
  stackLen.current = stack.length
  useLayoutEffect(() => {
    const y = scrolls.current.get(pageKey) ?? 0
    window.scrollTo(0, y)
  }, [pageKey])
  // Which way the page moves in: along the tab bar order for tabs, forward for
  // a product opened on top, back when it closes. Kept in a ref so re-renders
  // that are not navigation don't restart the animation.
  const seen = useRef({ tab, depth: stack.length })
  const motion = useRef<'enter' | 'right' | 'left' | 'push' | 'pop'>('enter')
  if (seen.current.tab !== tab || seen.current.depth !== stack.length) {
    const order: Tab[] = ['home', 'search', 'lists', 'leaflets', 'profile', 'coupons', 'scan']
    motion.current = stack.length > seen.current.depth ? 'push'
      : stack.length < seen.current.depth ? 'pop'
      : order.indexOf(tab) >= order.indexOf(seen.current.tab) ? 'right' : 'left'
    seen.current = { tab, depth: stack.length }
  }
  // Pages you have visited stay mounted (hidden), so going back to one is
  // instant and keeps its scroll, search and filters instead of being rebuilt.
  const visited = useRef(new Set<Tab>())
  visited.current.add(tab)
  const pageFor = (t: Tab) => t === 'home' ? <Home />
    : t === 'search' ? <SearchScreen />
    : t === 'scan' ? <Scan />
    : t === 'lists' ? <Lists />
    : t === 'leaflets' ? <Leaflets />
    : t === 'coupons' ? <Coupons />
    : <Profile />
  const KEEP: Tab[] = ['home', 'search', 'lists', 'leaflets']
  const screen = (
    <>
      {[...visited.current].filter((t) => KEEP.includes(t) || t === tab).map((t) => (
        <div key={t} className="tab-pane" hidden={t !== tab || !!top}>{pageFor(t)}</div>
      ))}
      {top && <ProductScreen key={top + stack.length} id={top} />}
    </>
  )
  // pages that are not kept (scan, profile, coupons) are forgotten when you leave them
  for (const t of [...visited.current]) if (!KEEP.includes(t) && t !== tab) visited.current.delete(t)

  return (
    <NavCtx.Provider value={nav}>
      <div className="shell" data-motion={motion.current}>
        {!welcomed && <Welcome onDone={finishWelcome} />}
        {screen}
        <WatchToast />
        {!nativeDock && <nav className="dock" aria-label="Main">
          {barGlass.svg}{scanGlass.svg}
          <div ref={barRef} className={'dock-bar glass' + (barGlass.active ? ' refract' : '')} style={barGlass.style}>
            {tabBtn('home', t('tab.home'), <HomeIcon />)}
            {tabBtn('search', t('tab.search'), <Bag />)}
            {tabBtn('lists', t('tab.list'), <List />)}
            {tabBtn('leaflets', t('tab.leaflets'), <Paper />, newLeaflets && tab !== 'leaflets')}
          </div>
          <button ref={scanRef} style={tab === 'scan' && !top ? undefined : scanGlass.style} className={'dock-scan glass' + (scanGlass.active ? ' refract' : '') + (tab === 'scan' && !top ? ' on' : '')} onClick={() => nav.go('scan')} aria-label={t('tab.scan')}>
            <ScanIcon size={26} />
          </button>
        </nav>}
      </div>
    </NavCtx.Provider>
  )

  function tabBtn(t: Tab, label: string, children: React.ReactNode, dot = false) {
    return (
      <button key={t} className={'tab' + (tab === t && !top ? ' on' : '')} onClick={() => nav.go(t)} aria-label={label}>
        {dot && <span className="tab-dot" aria-hidden />}
        {children}
        <span>{label}</span>
      </button>
    )
  }
}
