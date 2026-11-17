// Monthly food budget: how much of it the month's receipts have used, and
// where the month is heading at the current pace.

export interface BudgetStatus {
  budgetCents: number
  spentCents: number
  leftCents: number
  /** share of the budget used, 0..∞ */
  used: number
  daysLeft: number
  /** spending for the whole month at the pace so far; undefined early in the month */
  projectedCents?: number
  level: 'ok' | 'near' | 'over'
}

export function budgetStatus(budgetCents: number, spentCents: number, now = new Date()): BudgetStatus {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const day = now.getDate()
  const used = budgetCents > 0 ? spentCents / budgetCents : 0
  const projected = day >= 5 && spentCents > 0 ? Math.round((spentCents / day) * days) : undefined
  return {
    budgetCents,
    spentCents,
    leftCents: budgetCents - spentCents,
    used,
    daysLeft: days - day,
    projectedCents: projected,
    level: used >= 1 ? 'over' : used >= 0.8 ? 'near' : 'ok',
  }
}

/** "400", "400,50 €", "1 200" → cents; undefined when it isn't a sensible amount. */
export function parseEuros(text: string): number | undefined {
  const t = text.replace(/[€\s]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined
  const c = Math.round(parseFloat(t) * 100)
  return c >= 1000 && c <= 1_000_000 ? c : undefined
}
