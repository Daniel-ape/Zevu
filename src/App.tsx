import { useEffect, useMemo, useState } from 'react'
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
  const [tab, setTab] = useState<Tab>(fromHash)
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
        <nav className="dock" aria-label="Main">
          <div className="dock-bar glass">
            {tabBtn('home', t('tab.home'), <HomeIcon />)}
            {tabBtn('search', t('tab.search'), <Search />)}
            {tabBtn('lists', t('tab.list'), <List />)}
            {tabBtn('leaflets', t('tab.leaflets'), <Paper />)}
            {tabBtn('profile', t('tab.you'), <User />)}
          </div>
          <button className={'dock-scan glass' + (tab === 'scan' && !top ? ' on' : '')} onClick={() => nav.go('scan')} aria-label={t('tab.scan')}>
            <ScanIcon size={26} />
          </button>
        </nav>
      </div>
    </NavCtx.Provider>
  )

  function tabBtn(t: Tab, label: string, children: React.ReactNode) {
    return (
      <button key={t} className={'tab' + (tab === t && !top ? ' on' : '')} onClick={() => nav.go(t)} aria-label={label}>
        {children}
        <span>{label}</span>
      </button>
    )
  }
}
