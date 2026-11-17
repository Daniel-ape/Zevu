import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { cleanCode, inviteUrl, prettyCode } from '../data/sharedLists'
import { Sheet } from './Sheet'
import { People } from './icons'

/** Shares a list with family: shows its code and sends an invite link. */
export function ShareListSheet({ listId, name, onClose }: { listId: string; name: string; onClose: () => void }) {
  const { t, shareList } = useStore()
  const [code, setCode] = useState<string>()
  const [err, setErr] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { shareList(listId).then(setCode, () => setErr(true)) }, [listId, shareList])

  const invite = async () => {
    if (!code) return
    const text = t('sh.inviteText', { name, url: inviteUrl(code), code: prettyCode(code) })
    try {
      if (navigator.share) await navigator.share({ title: name, text })
      else { await navigator.clipboard.writeText(text); setNote(t('sh.copied')) }
    } catch { /* closed the share sheet */ }
  }

  return (
    <Sheet title={t('sh.title')} onClose={onClose} closeLabel={t('common.cancel')}>
      <div className="share-list">
        {err ? <p className="fb-err">{t('sh.failed')}</p> : (
          <>
            <div className="share-ico" aria-hidden><People size={28} /></div>
            <p className="share-hint">{t('sh.hint')}</p>
            <div className={'share-code' + (code ? '' : ' wait')} aria-live="polite"><span>{code ? prettyCode(code) : '·····-·····'}</span></div>
            <button className="btn primary" disabled={!code} onClick={invite}>{t('sh.shareBtn')}</button>
            {note && <p className="fb-note share-note">{note}</p>}
          </>
        )}
      </div>
    </Sheet>
  )
}

/** Joins a list someone shared, by typing its code. */
export function JoinListSheet({ onClose, onJoined }: { onClose: () => void; onJoined: (name: string) => void }) {
  const { t, joinShared } = useStore()
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'missing' | 'failed'>('idle')
  const join = async () => {
    setState('busy')
    try {
      const name = await joinShared(code)
      if (name == null) return setState('missing')
      onJoined(name)
      onClose()
    } catch { setState('failed') }
  }
  return (
    <Sheet title={t('sh.joinTitle')} onClose={onClose} closeLabel={t('common.cancel')}>
      <form className="share-list" onSubmit={(e) => { e.preventDefault(); if (cleanCode(code).length >= 8) void join() }}>
        <div className="share-ico" aria-hidden><People size={28} /></div>
        <p className="share-hint">{t('sh.joinHint')}</p>
        <label className="search share-input">
          <input autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={t('sh.code')}
            value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setState('idle') }} />
        </label>
        {state === 'missing' && <p className="fb-err">{t('sh.notFound')}</p>}
        {state === 'failed' && <p className="fb-err">{t('sh.failed')}</p>}
        <button className="btn primary" type="submit" disabled={state === 'busy' || cleanCode(code).length < 8}>{state === 'busy' ? t('sh.joining') : t('sh.joinBtn')}</button>
      </form>
    </Sheet>
  )
}
