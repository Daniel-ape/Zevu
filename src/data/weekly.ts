// "Your week in prices": a notification every Sunday at 10 with where the
// shopping list is cheapest, how many of its products are on offer and how
// many watched products got cheaper. Worked out by the app with everything it
// knows, whenever the list or prices change, and handed to the phone to show
// on Sunday (local notification: works even if the app isn't opened then).
import { useEffect, useMemo, useState } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { basketTotals, euro } from '../domain/pricing'
import { isNativeApp } from './openLink'
import { useListDeals } from './listDeals'
import { useStore } from './store'

const KEY = 'hintaopas:weekly'
const ID = 7700
const EVENT = 'hintaopas:weekly'

export const weeklyOn = () => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } }
export function setWeeklyOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode */ }
  dispatchEvent(new Event(EVENT))
}

/** Next Sunday 10:00 local time (today, when it is Sunday before 10). */
export function nextSunday10(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(10, 0, 0, 0)
  const add = (7 - d.getDay()) % 7
  d.setDate(d.getDate() + add)
  if (d <= now) d.setDate(d.getDate() + 7)
  return d
}

export function useWeeklySummary() {
  const { list, products, observations, retailers, watched, pricesOf, t } = useStore()
  const deals = useListDeals()
  const [on, setOn] = useState(weeklyOn)
  useEffect(() => {
    const f = () => setOn(weeklyOn())
    addEventListener(EVENT, f)
    return () => removeEventListener(EVENT, f)
  }, [])

  const body = useMemo(() => {
    if (!isNativeApp || !products.length) return ''
    const parts: string[] = []
    if (list.items.length) {
      const totals = basketTotals(list, products, observations, retailers).filter((x) => x.missing === 0).sort((a, b) => a.totalCents - b.totalCents)
      const best = totals[0]
      const worst = totals[totals.length - 1]
      if (best) {
        const name = list.name === 'Weekly shop' ? t('list.defaultName') : list.name
        const saving = worst ? worst.totalCents - best.totalCents : 0
        parts.push(saving >= 50
          ? t('wk.bestSave', { list: name, store: best.retailer.name, total: euro(best.totalCents), save: euro(saving) })
          : t('wk.best', { list: name, store: best.retailer.name, total: euro(best.totalCents) }))
      }
    }
    if (deals.length) parts.push(t(deals.length === 1 ? 'wk.deals1' : 'wk.deals', { n: deals.length }))
    const cheaper = watched.filter((w) => {
      if (w.baselineCents == null) return false
      const now = Math.min(...pricesOf(w.productId).map((o) => o.priceCents))
      return Number.isFinite(now) && now < w.baselineCents
    }).length
    if (cheaper) parts.push(t(cheaper === 1 ? 'wk.cheaper1' : 'wk.cheaper', { n: cheaper }))
    return parts.join(' ')
  }, [list, products, observations, retailers, deals, watched, pricesOf, t])

  useEffect(() => {
    if (!isNativeApp) return
    const id = window.setTimeout(async () => {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: ID }] })
        if (!on || !body) return
        if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
        await LocalNotifications.schedule({
          notifications: [{ id: ID, title: t('wk.title'), body, schedule: { at: nextSunday10(), allowWhileIdle: true } }],
        })
      } catch { /* no notifications on this phone */ }
    }, 3000)
    return () => clearTimeout(id)
  }, [body, on, t])
}
