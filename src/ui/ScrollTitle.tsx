import { useEffect, useState } from 'react'

/**
 * iOS-style navigation bar: when the page's large title scrolls away, a slim
 * glass bar with the same title appears at the top. Works on every screen
 * that has an <h1>; `watch` re-runs it when the screen changes.
 */
export function ScrollTitle({ watch }: { watch: string }) {
  const [title, setTitle] = useState('')
  const [shown, setShown] = useState(false)
  useEffect(() => {
    setShown(false)
    let io: IntersectionObserver | null = null
    const t = setTimeout(() => {
      const h1 = document.querySelector('.screen h1')
      if (!h1) { setTitle(''); return }
      setTitle(h1.textContent ?? '')
      io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
      io.observe(h1)
    }, 60)
    return () => { clearTimeout(t); io?.disconnect() }
  }, [watch])
  if (!title) return null
  return <div className={'scroll-title' + (shown ? ' on' : '')} aria-hidden>{title}</div>
}
