import { useEffect, useState } from 'react'
import { accountsEnabled, onSession } from '../data/account'
import { useStore } from '../data/store'
import { useNav } from '../nav'
import { User } from './icons'

/** Top-right button to the You page: the Google profile picture when signed in, else a person icon. */
export function ProfileButton() {
  const { t } = useStore()
  const nav = useNav()
  const [pic, setPic] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    if (!accountsEnabled) return
    return onSession((s) => {
      setSignedIn(!!s)
      const url = s?.user.user_metadata?.avatar_url ?? s?.user.user_metadata?.picture
      setPic(typeof url === 'string' && url.startsWith('https://') ? url : null)
      setBroken(false)
    })
  }, [])
  return (
    <button className={'profile-btn' + (signedIn ? ' in' : '')} onClick={() => nav.go('profile')} aria-label={t('tab.you')}>
      {pic && !broken ? <img src={pic} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <User size={22} />}
    </button>
  )
}
