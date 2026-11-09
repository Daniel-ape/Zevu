import { useEffect, useState, type ReactNode } from 'react'
import { Portal } from '../ui/Portal'
import type { Session } from '@supabase/supabase-js'
import { accountsEnabled, deleteAccount, onSession, signInWithGoogle, signOut, takeSignInError } from '../data/account'
import { LegalText, legalTitle } from '../ui/Legal'
import { useStore, type Theme } from '../data/store'
import { euro } from '../domain/pricing'
import { retailerName, type Receipt } from '../domain/receipts'
import { LANGS, LOCALE } from '../i18n'
import { Back, Bell, Chart, Check, Chevron, Contrast, Globe, Info, Paper, Plus, Receipt as ReceiptIcon, Shield, Store, Ticket } from '../ui/icons'
import { useNav, type Tab } from '../nav'
import { ReceiptSheet } from './ReceiptSheet'
import { Spending } from '../ui/Spending'
import { WatchList } from '../ui/WatchList'
import { allowNotify, notifyStatus, testNotify } from '../data/priceAlerts'

type Page = 'spending' | 'receipts' | 'stores' | 'watched' | 'language' | 'appearance' | 'notify' | 'about' | 'privacy' | 'sources' | 'terms' | 'info'

/** Open a page of the You tab from elsewhere (call before nav.go('profile')). */
let wanted: { page: Page; from: Tab } | null = null
/** Opens a page of You from another tab; its back button then returns to that tab. */
export function openProfilePage(page: Page, from: Tab) { wanted = { page, from } }

// One row of the menu: icon, title, current value, chevron.
function MenuRow({ icon, title, value, onClick }: { icon: ReactNode; title: string; value?: string; onClick: () => void }) {
  return (
    <button className="row menu-row" onClick={onClick}>
      <span className="menu-icon">{icon}</span>
      <span className="grow title">{title}</span>
      {value && <span className="menu-value">{value}</span>}
      <span className="muted"><Chevron /></span>
    </button>
  )
}

export function Profile() {
  const { theme, setTheme, lang, setLang, addReceipt, receipts, allRetailers, myStores, toggleMyStore, watched, coupons, t } = useStore()
  const nav = useNav()
  // Opened from another tab (bell, savings card…): back on that page goes back there.
  const [entry] = useState(() => { const w = wanted; wanted = null; return w })
  const [page, setPage] = useState<Page | null>(entry?.page ?? null)
  const [notify, setNotify] = useState<'on' | 'off' | 'na'>('na')
  useEffect(() => { notifyStatus().then(setNotify) }, [page])
  const back = () => {
    if (page === 'about' || page === 'privacy' || page === 'sources' || page === 'terms') return setPage('info')
    if (entry && page === entry.page && entry.from !== 'profile') return nav.go(entry.from)
    setPage(null)
  }
  const [sheet, setSheet] = useState<{ receipt?: Receipt } | null>(null)
  const [undo, setUndo] = useState<Receipt | null>(null)

  const now = new Date()
  const monthTotal = receipts
    .filter((r) => { const d = new Date(r.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() })
    .reduce((sum, r) => sum + (r.totalCents ?? r.items.reduce((x, i) => x + i.priceCents, 0)), 0)
  const titles: Record<Page, string> = {
    spending: t('spend.title'), receipts: t('you.groupReceipts'), stores: t('stores.title'), watched: t('watch.title'),
    language: t('you.language'), appearance: t('you.appearance'), notify: t('nt.title'), about: legalTitle('about', lang),
    privacy: legalTitle('privacy', lang), sources: legalTitle('sources', lang), terms: legalTitle('terms', lang), info: t('you.info'),
  }

  const sheets = (
    <>
      {sheet && (
        <ReceiptSheet
          receipt={sheet.receipt}
          onClose={() => setSheet(null)}
          onDeleted={(r) => { setUndo(r); setTimeout(() => setUndo((u) => (u === r ? null : u)), 6000) }}
        />
      )}
      {undo && (
        <div className="toast">
          {t('undo.receiptDeleted')}
          <button onClick={() => { addReceipt(undo); setUndo(null) }}>{t('undo.undo')}</button>
        </div>
      )}
    </>
  )

  if (page) {
    return (
      <div className="screen push">
        <div className="topbar sticky">
          <button className="icon-btn" onClick={back} aria-label={t('product.back')}><Back /></button>
          <h2 style={{ flex: 1, textAlign: 'center', marginRight: 44 }}>{titles[page]}</h2>
        </div>

        {page === 'spending' && <div className="group-body" style={{ padding: 16 }}><Spending /></div>}

        {page === 'receipts' && (
          <>
            <div className="rows">
              <button className="row" onClick={() => setSheet({})}>
                <div className="grow title" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} /> {t('rc.import')}
                </div>
              </button>
              {receipts.map((r) => (
                <button key={r.id} className="row" onClick={() => setSheet({ receipt: r })}>
                  <div className="grow">
                    <div className="title">{retailerName(r, allRetailers)}</div>
                    <div className="sub">{new Date(r.date).toLocaleDateString(LOCALE[lang])} · {t('rc.items', { n: r.items.length })}</div>
                  </div>
                  <div className="price" style={{ fontSize: 15 }}>{euro(r.totalCents ?? r.items.reduce((x, i) => x + i.priceCents, 0))}</div>
                  <span className="muted"><Chevron /></span>
                </button>
              ))}
            </div>
            <p className="group-note">{t('rc.importNote')}</p>
          </>
        )}

        {page === 'stores' && (
          <>
            <div className="rows">
              {allRetailers.map((r) => (
                <button key={r.id} className="row" onClick={() => toggleMyStore(r.id)} aria-pressed={myStores.includes(r.id)}>
                  <span className="grow title">{r.name}</span>
                  <span className={'tick' + (myStores.includes(r.id) ? ' on' : '')}>{myStores.includes(r.id) && <Check size={16} />}</span>
                </button>
              ))}
            </div>
            <p className="group-note">{t('stores.note')}</p>
          </>
        )}

        {page === 'watched' && <WatchList />}

        {page === 'language' && (
          <div className="rows">
            {LANGS.map((l) => (
              <button key={l.id} className="row" onClick={() => setLang(l.id)}>
                <span className="grow title">{l.label}</span>
                {lang === l.id && <span style={{ color: 'var(--accent)' }}><Check size={18} /></span>}
              </button>
            ))}
          </div>
        )}

        {page === 'appearance' && (
          <div className="rows">
            {(['system', 'light', 'dark'] as Theme[]).map((th) => (
              <button key={th} className="row" onClick={() => setTheme(th)}>
                <span className="grow title">{t(`theme.${th}`)}</span>
                {theme === th && <span style={{ color: 'var(--accent)' }}><Check size={18} /></span>}
              </button>
            ))}
          </div>
        )}

        {page === 'notify' && <NotifyPage />}

        {page === 'info' && (
          <div className="rows group-rows">
            <MenuRow icon={<Info size={18} />} title={legalTitle('about', lang)} onClick={() => setPage('about')} />
            <MenuRow icon={<Shield size={18} />} title={legalTitle('privacy', lang)} onClick={() => setPage('privacy')} />
            <MenuRow icon={<Chart size={18} />} title={legalTitle('sources', lang)} onClick={() => setPage('sources')} />
            <MenuRow icon={<Paper size={18} />} title={legalTitle('terms', lang)} onClick={() => setPage('terms')} />
          </div>
        )}
        {page === 'info' && <p className="tiny muted" style={{ textAlign: 'center', marginTop: 20 }}>ZEVU · {t('you.version')} {__APP_VERSION__}</p>}
        {(page === 'about' || page === 'privacy' || page === 'sources' || page === 'terms') && <LegalText page={page} lang={lang} />}
        {page === 'privacy' && <DeleteData />}
        {sheets}
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar you-top">
        {/* You is opened from the picture on Home, so back goes there. */}
        <button className="icon-btn" onClick={() => nav.go('home')} aria-label={t('product.back')}><Back /></button>
        <h1>{t('you.title')}</h1>
      </div>
      <AccountCard />

      <div className="group-label">{t('you.groupMoney')}</div>
      <div className="rows group-rows">
        <MenuRow icon={<Chart size={18} />} title={t('spend.title')} value={euro(monthTotal)} onClick={() => setPage('spending')} />
        <MenuRow icon={<ReceiptIcon size={18} />} title={t('you.groupReceipts')} value={String(receipts.length)} onClick={() => setPage('receipts')} />
      </div>

      <div className="group-label">{t('you.groupShopping')}</div>
      <div className="rows group-rows">
        <MenuRow icon={<Store size={18} />} title={t('stores.title')} value={myStores.length ? String(myStores.length) : t('you.allStores')} onClick={() => setPage('stores')} />
        <MenuRow icon={<Bell size={18} />} title={t('watch.title')} value={String(watched.length)} onClick={() => setPage('watched')} />
        <MenuRow icon={<Ticket size={18} />} title={t('cp.title')} value={String(coupons.filter((c) => !c.used).length)} onClick={() => nav.go('coupons')} />
      </div>

      <div className="group-label">{t('you.groupSettings')}</div>
      <div className="rows group-rows">
        <MenuRow icon={<Globe size={18} />} title={t('you.language')} value={LANGS.find((l) => l.id === lang)?.label} onClick={() => setPage('language')} />
        <MenuRow icon={<Contrast size={18} />} title={t('you.appearance')} value={t(`theme.${theme}`)} onClick={() => setPage('appearance')} />
        {notify !== 'na' && <MenuRow icon={<Bell size={18} />} title={t('nt.title')} value={t(notify === 'on' ? 'nt.on' : 'nt.off')} onClick={() => setPage('notify')} />}
        <MenuRow icon={<Info size={18} />} title={t('you.info')} onClick={() => setPage('info')} />
      </div>
      {sheets}
    </div>
  )
}

/** Signed in with Google (synced) or not; hidden when accounts are not set up. */
function AccountCard() {
  const { t } = useStore()
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => (takeSignInError() ? t('acc.failed') : ''))
  useEffect(() => onSession(setSession), [])
  if (!accountsEnabled) return null
  if (session) {
    const email = session.user.email ?? ''
    const name = (session.user.user_metadata?.full_name as string | undefined) ?? email
    const pic = session.user.user_metadata?.avatar_url as string | undefined
    return (
      <div className="account-card">
        {pic ? <img className="account-pic" src={pic} alt="" referrerPolicy="no-referrer" /> : <span className="account-pic">{name.slice(0, 1).toUpperCase()}</span>}
        <div className="grow">
          <b>{name}</b>
          <span className="sub">{t('acc.synced')}</span>
        </div>
        <button className="link small" disabled={busy} onClick={async () => { setBusy(true); await signOut().catch(() => {}); setBusy(false) }}>{t('acc.signOut')}</button>
      </div>
    )
  }
  return (
    <div className="account-card">
      <div className="grow"><span className="sub">{t('acc.signInHint')}</span></div>
      <button className="btn google small" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await signInWithGoogle() } catch { setError(t('acc.failed')) } finally { setBusy(false) } }}>
        {busy ? t('acc.signingIn') : t('acc.google')}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  )
}

/** Under Privacy: delete the account (and its synced data) or this phone's data. */
function DeleteData() {
  const { t } = useStore()
  const [session, setSession] = useState<Session | null>(null)
  const [ask, setAsk] = useState<'account' | 'local' | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => onSession(setSession), [])
  const wipeLocal = () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith('hintaopas:')).forEach((k) => localStorage.removeItem(k)) } catch { /* private mode */ }
    location.reload()
  }
  const run = async () => {
    setBusy(true); setMsg('')
    try {
      if (ask === 'account') {
        const r = await deleteAccount()
        setMsg(r === 'done' ? t('del.accountDone') : t('del.accountPartial'))
      } else wipeLocal()
    } catch {
      setMsg(t('del.failed'))
    } finally { setBusy(false); setAsk(null) }
  }
  return (
    <div className="legal-actions">
      {session && <button className="btn danger-text" onClick={() => setAsk('account')}>{t('del.account')}</button>}
      <button className="btn danger-text" onClick={() => setAsk('local')}>{t('del.local')}</button>
      {msg && <p className="small" style={{ textAlign: 'center' }}>{msg}</p>}
      {ask && (
        <Portal><div className="sheet-backdrop" onClick={() => setAsk(null)}>
          <div className="sheet menu-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <p style={{ lineHeight: 1.5, margin: '4px 4px 16px' }}>{ask === 'account' ? t('del.accountAsk') : t('del.localAsk')}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn primary danger-bg" disabled={busy} onClick={run}>{busy ? '…' : t('del.confirm')}</button>
              <button className="btn" onClick={() => setAsk(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div></Portal>
      )}
    </div>
  )
}

/** Price notifications: whether they are on, turning them on, and a test. */
function NotifyPage() {
  const { t } = useStore()
  const [status, setStatus] = useState<'on' | 'off' | 'na' | null>(null)
  const [sent, setSent] = useState(false)
  useEffect(() => { notifyStatus().then(setStatus) }, [])
  return (
    <div>
      <p className="small muted" style={{ lineHeight: 1.5, margin: '0 4px 14px' }}>{t('nt.about')}</p>
      <div className="rows group-rows">
        <div className="row"><span className="grow title">{t('nt.status')}</span><span className={status === 'on' ? 'good' : 'muted'} style={{ fontWeight: 600 }}>{status ? t(status === 'on' ? 'nt.on' : 'nt.off') : '…'}</span></div>
      </div>
      {status === 'off' && <button className="btn primary" style={{ marginTop: 14 }} onClick={async () => setStatus(await allowNotify())}>{t('nt.allow')}</button>}
      {status === 'off' && <p className="tiny muted" style={{ margin: '10px 4px 0', lineHeight: 1.5 }}>{t('nt.denied')}</p>}
      {status === 'on' && (
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={async () => { setSent(await testNotify(t('nt.testTitle'), t('nt.testBody'))) }}>
          {sent ? t('nt.sent') : t('nt.test')}
        </button>
      )}
    </div>
  )
}

