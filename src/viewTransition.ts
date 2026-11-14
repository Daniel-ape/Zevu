import { flushSync } from 'react-dom'

// Page changes. A product page opening or closing slides with the system's own
// view transitions (Safari 18 / iOS 18 and newer, Chrome): the system takes a
// picture of the old and the new page and moves the pictures on the graphics chip.
// Tab switches don't take pictures at all: the page changes at once and the new
// one fades in with plain CSS, like an iPhone tab bar, so a tap answers right away.
// Without support, with "reduce motion" on, or on cheaper phones the page just changes.

type VT = { finished: Promise<void>; ready?: Promise<void>; updateCallbackDone?: Promise<void>; skipTransition?: () => void }
type Doc = Document & { startViewTransition?: (cb: () => void) => VT }

export const viewTransitions = typeof document !== 'undefined' && !!(document as Doc).startViewTransition
if (viewTransitions) document.documentElement.classList.add('vt-on')

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let running: VT | null = null
// taps that came while a slide was still moving: applied, in order, without
// a second animation, as soon as the first one is done. Starting a new view
// transition on top of one still running is what made fast tapping crash on iPhone.
let queued: (() => void)[] = []

function flushQueued() {
  const q = queued
  queued = []
  if (!q.length) return
  try { flushSync(() => q.forEach((f) => f())) } catch { q.forEach((f) => f()) }
}

export function transition(kind: 'right' | 'left' | 'push' | 'pop' | 'fade', update: () => void) {
  if (running) {
    queued.push(update)
    try { running.skipTransition?.() } catch { /* already done */ }
    return
  }
  const d = document as Doc
  const slide = kind === 'push' || kind === 'pop'
  if (!slide || !d.startViewTransition || reduced() || document.documentElement.classList.contains('lite')) { update(); return }
  const root = document.documentElement
  root.dataset.vt = kind
  try {
    const t = d.startViewTransition(() => flushSync(update))
    running = t
    // skipping a slide rejects these; that is expected, not an error
    t.ready?.catch(() => {})
    t.updateCallbackDone?.catch(() => {})
    const done = () => {
      if (running !== t) return
      running = null
      delete root.dataset.vt
      flushQueued()
    }
    t.finished.then(done, done)
    // never wait forever for a slide the system lost track of
    setTimeout(done, 1500)
  } catch {
    running = null
    delete root.dataset.vt
    update()
  }
}
