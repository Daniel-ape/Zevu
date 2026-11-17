// The monthly budget the user set (kept on this phone), and a notification
// when the month's receipts pass 80 % and 100 % of it.
import { useEffect, useMemo, useState } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { budgetStatus } from '../domain/budget'
import { euro } from '../domain/pricing'
import { savingsReport } from '../domain/receipts'
import { isNativeApp } from './openLink'
import { useStore } from './store'

const KEY = 'hintaopas:budget'
const TOLD = 'hintaopas:budgetTold'
const EVENT = 'hintaopas:budget'

export function getBudget(): number | null {
  try { const v = Number(localStorage.getItem(KEY)); return v > 0 ? v : null } catch { return null }
}
export function setBudget(cents: number | null) {
  try { if (cents) localStorage.setItem(KEY, String(cents)); else localStorage.removeItem(KEY) } catch { /* private mode */ }
  dispatchEvent(new Event(EVENT))
}

/** The budget and this month's status, updated when receipts or the budget change. */
export function useBudget() {
  const { receipts, pricesOf } = useStore()
  const [budget, setB] = useState(getBudget)
  useEffect(() => {
    const f = () => setB(getBudget())
    addEventListener(EVENT, f)
    return () => removeEventListener(EVENT, f)
  }, [])
  const status = useMemo(() => {
    if (!budget) return null
    const spent = savingsReport(receipts, pricesOf, new Date()).spentCents
    return budgetStatus(budget, spent)
  }, [budget, receipts, pricesOf])
  return { budget, status }
}

/** Tells once a month when spending passes 80 % and when it passes the budget. */
export function useBudgetAlerts() {
  const { t } = useStore()
  const { status } = useBudget()
  useEffect(() => {
    if (!isNativeApp || !status || status.level === 'ok') return
    const now = new Date()
    const month = `${now.getFullYear()}-${now.getMonth() + 1}`
    let told: { month?: string; level?: string } = {}
    try { told = JSON.parse(localStorage.getItem(TOLD) ?? '{}') } catch { /* */ }
    const already = told.month === month && (told.level === status.level || told.level === 'over')
    if (already) return
    try { localStorage.setItem(TOLD, JSON.stringify({ month, level: status.level })) } catch { /* */ }
    const body = status.level === 'over'
      ? t('bud.overBody', { spent: euro(status.spentCents), budget: euro(status.budgetCents) })
      : t('bud.nearBody', { left: euro(status.leftCents), days: status.daysLeft })
    void (async () => {
      try {
        if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
        await LocalNotifications.schedule({ notifications: [{ id: 7800 + (status.level === 'over' ? 1 : 0), title: t(status.level === 'over' ? 'bud.overTitle' : 'bud.nearTitle'), body, schedule: { at: new Date(Date.now() + 1500) } }] })
      } catch { /* no notifications here */ }
    })()
  }, [status, t])
}
