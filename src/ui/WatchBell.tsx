import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useNav } from '../nav'
import { openProfilePage } from '../screens/Profile'
import { Bell } from './icons'

/** Rings for a moment whenever a product is added to the watch list. */
function useRing() {
  const { watched } = useStore()
  const prev = useRef(watched.length)
  const [ring, setRing] = useState(0)
  useEffect(() => {
    if (watched.length > prev.current) setRing((r) => r + 1)
    prev.current = watched.length
  }, [watched.length])
  return ring
}

/** Bell in the corner of Home: how many products are watched; opens the watch list. */
export function WatchBell() {
  const { watched, t } = useStore()
  const nav = useNav()
  return (
    <button className="bell-btn" onClick={() => { openProfilePage('watched'); nav.go('profile') }} aria-label={t('watch.title')}>
      <span className="bell-icon"><Bell size={21} /></span>
      {watched.length > 0 && <i className="bell-n" key={watched.length}>{watched.length}</i>}
    </button>
  )
}

/**
 * Shown over every page when a product starts being watched: a ringing bell
 * that flies towards the corner, with a line saying what happens next.
 */
export function WatchToast() {
  const { t } = useStore()
  const nav = useNav()
  const ring = useRing()
  const [show, setShow] = useState(0)
  useEffect(() => {
    if (!ring) return
    setShow(ring)
    const id = setTimeout(() => setShow(0), 3200)
    return () => clearTimeout(id)
  }, [ring])
  if (!show) return null
  return (
    <div className="watch-toast" key={show} role="status">
      <span className="wt-bell"><Bell size={20} /></span>
      <span className="wt-text">
        <b>{t('watch.added')}</b>
        <span>{t('watch.addedSub')}</span>
      </span>
      <button onClick={() => { setShow(0); openProfilePage('watched'); nav.go('profile') }}>{t('watch.choose')}</button>
    </div>
  )
}
