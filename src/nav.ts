import { createContext, useContext } from 'react'
import type { CategoryId } from './domain/types'

export type Tab = 'home' | 'search' | 'scan' | 'lists' | 'leaflets' | 'profile'

export interface Nav {
  tab: Tab
  go: (tab: Tab, opts?: { category?: CategoryId | 'all'; focus?: boolean }) => void
  openProduct: (id: string) => void
  back: () => void
  searchCategory: CategoryId | 'all'
  searchFocus: boolean
}

export const NavCtx = createContext<Nav | null>(null)
export const useNav = () => {
  const n = useContext(NavCtx)
  if (!n) throw new Error('useNav outside provider')
  return n
}
