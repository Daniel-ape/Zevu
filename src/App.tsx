import { useEffect, useMemo, useRef, useState } from 'react'
import { StoreProvider, useStore } from './data/store'
import type { CategoryId } from './domain/types'
import { NavCtx, type Nav, type Tab } from './nav'
import { Home as HomeIcon, List, Paper, Scan as ScanIcon, Search, User } from './ui/icons'
import { Home } from './screens/Home'
import { SearchScreen } from './screens/SearchScreen'
import { ProductScreen } from './screens/ProductScreen'
import { Lists } from './screens/Lists'
import { Scan } from './screens/Scan'
import { Profile } from './screens/Profile'
import { Leaflets } from './screens/Leaflets'
import { useNewLeaflets } from './data/leafletFeed'
import { usePriceAlerts } from './data/priceAlerts'
import { autoLocate } from './data/nearby'
import { useLiquidGlass } from './ui/LiquidGlass'
import { WatchAlert } from './ui/WatchAlert'
import { DOCK_ICONS, NativeDock, wantsNativeDock } from './native/nativeDock'

const TABS: Tab[] = ['home', 'search', 'scan', 'lists', 'leaflets', 'profile']
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
  const barRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLButtonElement>(null)
  const barGlass = useLiquidGlass('lg-bar', barRef)
  const scanGlass = useLiquidGlass('lg-scan', scanRef, { bezel: 14, scale: 22 })
  // iPhone app: Apple's own Liquid Glass tab bar (native). Falls back to the web dock if it fails.
  const [nativeDock, setNativeDock] = useState(wantsNativeDock)
  const [stack, setStack] = useState<string[]>([]) // product ids opened on top of the tab
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
        setStack([])
        setSearchFocus(!!opts?.focus)
        if (t === 'search') setSearchCategory(opts?.category ?? 'all')
        setTab(t)
        try { history.replaceState(null, '', '#' + t) } catch { /* sandboxed */ }
      },
      openProduct: (id) => setStack((s) => [...s, id]),
      back: () => setStack((s) => s.slice(0, -1)),
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
  useEffect(() => {
    if (!nativeDock) return
    const ids: Tab[] = ['home', 'search', 'lists', 'leaflets', 'profile']
    const label = { home: 'tab.home', search: 'tab.search', lists: 'tab.list', leaflets: 'tab.leaflets', profile: 'tab.you' } as const
    NativeDock.show({
      tabs: ids.map((id) => ({ id, label: t(label[id as keyof typeof label]), icon: DOCK_ICONS[id] })),
      selected: top ? '' : tab,
      badges: newLeaflets && tab !== 'leaflets' ? ['leaflets'] : [],
      scanLabel: t('tab.scan'),
    }).catch(() => setNativeDock(false))
  }, [nativeDock, tab, top, newLeaflets, t])
  useEffect(() => {
    window.scrollTo(0, 0)
    document.querySelector('.screen')?.scrollTo(0, 0)
  }, [top, tab])
  const screen = top ? (
    <ProductScreen key={top + stack.length} id={top} />
  ) : tab === 'home' ? <Home key="home" />
    : tab === 'search' ? <SearchScreen key="search" />
    : tab === 'scan' ? <Scan key="scan" />
    : tab === 'lists' ? <Lists key="lists" />
    : tab === 'leaflets' ? <Leaflets key="leaflets" />
    : <Profile key="profile" />

  return (
    <NavCtx.Provider value={nav}>
      <div className="shell">
        {screen}
        <WatchAlert />
        {!nativeDock && <nav className="dock" aria-label="Main">
          {barGlass.svg}{scanGlass.svg}
          <div ref={barRef} className={'dock-bar glass' + (barGlass.active ? ' refract' : '')} style={barGlass.style}>
            {tabBtn('home', t('tab.home'), <HomeIcon />)}
            {tabBtn('search', t('tab.search'), <Search />)}
            {tabBtn('lists', t('tab.list'), <List />)}
            {tabBtn('leaflets', t('tab.leaflets'), <Paper />, newLeaflets && tab !== 'leaflets')}
            {tabBtn('profile', t('tab.you'), <User />)}
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
