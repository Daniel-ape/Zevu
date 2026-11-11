import { flushSync } from 'react-dom'

// Page changes with the system's own view transitions (Safari 18 / iOS 18 and
// newer, Chrome). The system takes a picture of the old and the new page and
// moves the pictures on the graphics chip, so the motion stays smooth even while
// the new page is being built. The dock stays still, like a tab bar on iPhone.
// Without support, or with "reduce motion" on, the page just changes.

type VT = { finished: Promise<void>; skipTransition?: () => void }
type Doc = Document & { startViewTransition?: (cb: () => void) => VT }

export const viewTransitions = typeof document !== 'undefined' && !!(document as Doc).startViewTransition
if (viewTransitions) document.documentElement.classList.add('vt-on')

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let running: VT | null = null

export function transition(kind: 'right' | 'left' | 'push' | 'pop' | 'fade', update: () => void) {
  const d = document as Doc
  // cheaper phones change pages instantly: no picture of the page to take and move
  if (!d.startViewTransition || reduced() || document.documentElement.classList.contains('lite')) { update(); return }
  // a second tap while a change is still moving: finish the first at once
  // instead of stacking animations
  if (running) { try { running.skipTransition?.() } catch { /* already done */ } }
  const root = document.documentElement
  root.dataset.vt = kind
  try {
    const t = d.startViewTransition(() => flushSync(update))
    running = t
    t.finished.finally(() => { if (running === t) { running = null; delete root.dataset.vt } })
  } catch {
    delete root.dataset.vt
    update()
  }
}
