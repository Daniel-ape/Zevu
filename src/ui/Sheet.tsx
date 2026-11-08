import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom sheet, iPhone style: the page behind stays put while it is open,
 * and it closes with the ✕ button, a tap outside, or a swipe down.
 */
export function Sheet({ title, onClose, children, closeLabel = 'Close' }: { title?: string; onClose: () => void; children: ReactNode; closeLabel?: string }) {
  const sheet = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  // The latest onClose, so callers can pass a new function each render without
  // the page lock below being undone and redone (which made the page jump).
  const close = useRef(onClose)
  close.current = onClose

  // Lock the page behind (iOS needs the fixed-body trick, overflow alone is not enough).
  useEffect(() => {
    const y = window.scrollY
    const b = document.body.style
    const prev = { position: b.position, top: b.top, width: b.width, overflow: b.overflow }
    Object.assign(b, { position: 'fixed', top: `-${y}px`, width: '100%', overflow: 'hidden' })
    const screen = document.querySelector<HTMLElement>('.screen')
    const prevScreen = screen?.style.overflow ?? ''
    if (screen) screen.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    addEventListener('keydown', onKey)
    return () => {
      Object.assign(b, prev)
      window.scrollTo(0, y)
      if (screen) screen.style.overflow = prevScreen
      removeEventListener('keydown', onKey)
    }
  }, [])

  const start = (e: React.TouchEvent) => {
    if ((sheet.current?.scrollTop ?? 0) > 0) return
    drag.current = { y: e.touches[0].clientY, dy: 0 }
  }
  const move = (e: React.TouchEvent) => {
    if (!drag.current || !sheet.current) return
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y)
    drag.current.dy = dy
    sheet.current.style.transform = `translateY(${dy}px)`
    sheet.current.style.transition = 'none'
  }
  const end = () => {
    if (!drag.current || !sheet.current) return
    const { dy } = drag.current
    drag.current = null
    sheet.current.style.transition = 'transform 0.25s ease'
    if (dy > 90) { sheet.current.style.transform = 'translateY(100%)'; setTimeout(onClose, 180) }
    else sheet.current.style.transform = ''
  }

  // Drawn at the top of the page (portal), so no animated or layered parent
  // can shift it or show through it.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose} onTouchMove={(e) => { if (e.target === e.currentTarget) e.preventDefault() }}>
      <div
        ref={sheet} className="sheet sheet-v2" role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()} onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      >
        <div className="sheet-top">
          <div className="sheet-grab" />
          <div className="sheet-head">
            {title && <h2>{title}</h2>}
            <button className="sheet-close" onClick={onClose} aria-label={closeLabel}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
