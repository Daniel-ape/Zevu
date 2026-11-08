import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { accountsEnabled, onSession, signInWithGoogle, signOut, takeSignInError } from '../data/account'
import { useStore, type Theme } from '../data/store'
import { euro } from '../domain/pricing'
import { retailerName, type Receipt } from '../domain/receipts'
import { LANGS, LOCALE } from '../i18n'
import { Back, Bell, Check, Chevron, Home, Info, Plus, Receipt as ReceiptIcon, Tag, Ticket } from '../ui/icons'
import { useNav } from '../nav'
import { ReceiptSheet } from './ReceiptSheet'
import { Spending } from '../ui/Spending'
import { WatchList } from '../ui/WatchList'

type Page = 'spending' | 'receipts' | 'stores' | 'watched' | 'language' | 'appearance' | 'about'

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
  const { theme, setTheme, lang, setLang, addReceipt, receipts, allRetailers, myStores, toggleMyStore, watched, cards, t } = useStore()
  const nav = useNav()
  const [page, setPage] = useState<Page | null>(null)
  const [sheet, setSheet] = useState<{ receipt?: Receipt } | null>(null)
  const [undo, setUndo] = useState<Receipt | null>(null)

  const now = new Date()
  const monthTotal = receipts
    .filter((r) => { const d = new Date(r.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() })
    .reduce((sum, r) => sum + (r.totalCents ?? r.items.reduce((x, i) => x + i.priceCents, 0)), 0)
  const titles: Record<Page, string> = {
    spending: t('spend.title'), receipts: t('you.groupReceipts'), stores: t('stores.title'), watched: t('watch.title'),
    language: t('you.language'), appearance: t('you.appearance'), about: t('you.groupAbout'),
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
          <button className="icon-btn" onClick={() => setPage(null)} aria-label={t('product.back')}><Back /></button>
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

        {page === 'about' && (
          <div className="rows">
            <div className="row">
              <div className="grow">
                <div className="title">{t('you.data')}</div>
                <div className="sub" style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>{t('you.dataNote')}</div>
              </div>
            </div>
          </div>
        )}
        {sheets}
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar"><h1>{t('you.title')}</h1></div>
      <AccountCard />

      <button className="list-card" onClick={() => setPage('spending')}>
        <span className="quick-icon"><ReceiptIcon size={22} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{t('you.thisMonth')}</b>
          <span className="sub">{t('you.receiptsCount', { n: receipts.length })}</span>
        </span>
        <span className="price">{euro(monthTotal)}</span>
      </button>

      <div className="section rows">
        <MenuRow icon={<ReceiptIcon size={18} />} title={t('you.groupReceipts')} value={String(receipts.length)} onClick={() => setPage('receipts')} />
        <MenuRow icon={<Tag size={18} />} title={t('spend.title')} onClick={() => setPage('spending')} />
      </div>

      <div className="section rows">
        <MenuRow icon={<Home size={18} />} title={t('stores.title')} value={myStores.length ? String(myStores.length) : t('you.allStores')} onClick={() => setPage('stores')} />
        <MenuRow icon={<Bell size={18} />} title={t('watch.title')} value={String(watched.length)} onClick={() => setPage('watched')} />
        <MenuRow icon={<Ticket size={18} />} title={t('cp.title')} value={String(cards.length)} onClick={() => nav.go('coupons')} />
      </div>

      <div className="section rows">
        <MenuRow icon={<b style={{ fontSize: 14 }}>Aa</b>} title={t('you.language')} value={LANGS.find((l) => l.id === lang)?.label} onClick={() => setPage('language')} />
        <MenuRow icon={<span style={{ fontSize: 17 }}>◐</span>} title={t('you.appearance')} value={t(`theme.${theme}`)} onClick={() => setPage('appearance')} />
      </div>

      <div className="section rows">
        <MenuRow icon={<Info size={18} />} title={t('you.groupAbout')} onClick={() => setPage('about')} />
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
