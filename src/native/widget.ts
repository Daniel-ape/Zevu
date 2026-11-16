// Feeds the Android home-screen widget (ListWidget.java): the active list,
// what is left to buy and the cheapest shop. Nothing happens elsewhere.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { useEffect, useMemo } from 'react'
import { useStore } from '../data/store'
import { basketTotals, euro } from '../domain/pricing'
import { productById } from '../domain/productIndex'

const Widget = registerPlugin<{ update(o: { data: string }): Promise<void> }>('ZevuWidget')
const on = Capacitor.getPlatform() === 'android'

export function useWidgetSync() {
  const { list, products, observations, retailers, t } = useStore()
  const data = useMemo(() => {
    if (!on || !products.length) return null
    const todo = list.items.filter((i) => !i.checked)
    const done = list.items.filter((i) => i.checked)
    const rows = [...todo, ...done].slice(0, 5).map((i) => {
      const p = productById(products, i.productId)
      return { t: `${i.quantity > 1 ? `${i.quantity} × ` : ''}${p?.name ?? i.productId}`, c: !!i.checked }
    })
    const best = list.items.length ? basketTotals(list, products, observations, retailers).find((x) => x.missing === 0) : undefined
    const name = list.name === 'Weekly shop' ? t('list.defaultName') : list.name
    return JSON.stringify({
      title: `${name} · ${t(todo.length === 1 ? 'list.items1' : 'list.items', { n: todo.length })}`,
      items: rows,
      more: list.items.length > 5 ? `+ ${list.items.length - 5}` : '',
      empty: t('list.empty'),
      footer: best ? `${t('list.cheapest')}: ${best.retailer.name} ${euro(best.totalCents)}` : '',
    })
  }, [list, products, observations, retailers, t])
  useEffect(() => {
    if (!data) return
    const id = window.setTimeout(() => { Widget.update({ data }).catch(() => {}) }, 1200)
    return () => clearTimeout(id)
  }, [data])
}
