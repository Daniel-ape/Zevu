import { useSyncExternalStore } from 'react'

// Quantities just tapped, shown at once on the button that was pressed while
// the list itself (and everything that depends on it) updates a moment later
// in the background. Only the buttons for that one product redraw right away.
const pending = new Map<string, number>()
const listeners = new Map<string, Set<() => void>>()

function notify(id: string) { listeners.get(id)?.forEach((f) => f()) }

export function setPendingQty(id: string, qty: number) {
  pending.set(id, qty)
  notify(id)
}

export function getPendingQty(id: string): number | undefined { return pending.get(id) }

/** Forget the tapped value once the list shows the same number. */
export function settlePendingQty(qtyOf: (id: string) => number) {
  for (const [id, q] of pending) if (qtyOf(id) === q) { pending.delete(id); notify(id) }
}

export function usePendingQty(id: string): number | undefined {
  return useSyncExternalStore(
    (cb) => {
      let s = listeners.get(id)
      if (!s) listeners.set(id, (s = new Set()))
      s.add(cb)
      return () => { s!.delete(cb); if (!s!.size) listeners.delete(id) }
    },
    () => pending.get(id),
  )
}
