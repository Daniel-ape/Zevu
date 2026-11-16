// Merging a shared list's changes from two phones (see data/sharedLists.ts).
import type { ShoppingListItem } from './types'

const same = (a?: ShoppingListItem, b?: ShoppingListItem) =>
  (!a && !b) || (!!a && !!b && a.quantity === b.quantity && !!a.checked === !!b.checked)

/**
 * Three-way merge, one product at a time: what this phone changed since the
 * last sync wins for that product; everything else comes from the shared copy.
 */
export function mergeItems(base: ShoppingListItem[], local: ShoppingListItem[], remote: ShoppingListItem[]): ShoppingListItem[] {
  const B = new Map(base.map((i) => [i.productId, i]))
  const L = new Map(local.map((i) => [i.productId, i]))
  const R = new Map(remote.map((i) => [i.productId, i]))
  const order = [...remote.map((i) => i.productId), ...local.map((i) => i.productId).filter((id) => !R.has(id))]
  const out: ShoppingListItem[] = []
  for (const id of new Set(order)) {
    const pick = same(B.get(id), L.get(id)) ? R.get(id) : L.get(id)
    if (pick) out.push(pick)
  }
  return out
}

export const itemsEqual = (a: ShoppingListItem[], b: ShoppingListItem[]) =>
  a.length === b.length && a.every((x, i) => x.productId === b[i].productId && same(x, b[i]))

