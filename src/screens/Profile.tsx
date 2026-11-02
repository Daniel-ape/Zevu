import { useState, type ReactNode } from 'react'
import { useStore, type Theme } from '../data/store'
import { euro } from '../domain/pricing'
import { retailerName, type Receipt } from '../domain/receipts'
import { LANGS, LOCALE } from '../i18n'
import { Chevron, Plus } from '../ui/icons'
import { ReceiptSheet } from './ReceiptSheet'
import { Spending } from '../ui/Spending'

function Group({ title, note, plain, children }: { title: string; note?: string; plain?: boolean; children: ReactNode }) {
  return (
    <section className="group">
      <div className="group-title">{title}</div>
      <div className={plain ? undefined : 'group-body'}>{children}</div>
      {note && <p className="group-note">{note}</p>}
    </section>
  )
}

export function Profile() {
  const { theme, setTheme, lang, setLang, addReceipt, receipts, allRetailers, myStores, toggleMyStore, t } = useStore()
  const [sheet, setSheet] = useState<{ receipt?: Receipt } | null>(null)
  const [undo, setUndo] = useState<Receipt | null>(null)

  return (
    <div className="screen">
      <div className="topbar"><h1>{t('you.title')}</h1></div>

      <Group title={t('spend.title')}>
        <Spending />
      </Group>

      <Group title={t('stores.title')} note={t('stores.note')} plain>
        <div className="chip-wrap">
          {allRetailers.map((r) => (
            <button key={r.id} className={'chip' + (myStores.includes(r.id) ? ' on' : '')} onClick={() => toggleMyStore(r.id)} aria-pressed={myStores.includes(r.id)}>
              {r.name}
            </button>
          ))}
        </div>
      </Group>

      <Group title={t('you.groupReceipts')} note={t('rc.importNote')}>
        <button className="row" onClick={() => setSheet({})}>
          <div className="grow title" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={18} /> {t('rc.import')}
          </div>
        </button>
        {receipts.map((r) => (
          <button key={r.id} className="row" onClick={() => setSheet({ receipt: r })}>
            <div className="grow">
              <div className="title">{retailerName(r, allRetailers)}</div>
              <div className="sub">
                {new Date(r.date).toLocaleDateString(LOCALE[lang])} · {t('rc.items', { n: r.items.length })}
              </div>
            </div>
            <div className="price" style={{ fontSize: 15 }}>
              {euro(r.totalCents ?? r.items.reduce((s, i) => s + i.priceCents, 0))}
            </div>
            <span className="muted"><Chevron /></span>
          </button>
        ))}
      </Group>

      <Group title={t('you.groupSettings')}>
        <div className="row">
          <div className="grow title">{t('you.language')}</div>
          <div className="seg">
            {LANGS.map((l) => (
              <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>{l.label}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="grow title">{t('you.appearance')}</div>
          <div className="seg">
            {(['system', 'light', 'dark'] as Theme[]).map((th) => (
              <button key={th} className={theme === th ? 'on' : ''} onClick={() => setTheme(th)}>{t(`theme.${th}`)}</button>
            ))}
          </div>
        </div>
      </Group>

      <Group title={t('you.groupAbout')}>
        <div className="row">
          <div className="grow">
            <div className="title">{t('you.data')}</div>
            <div className="sub" style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>{t('you.dataNote')}</div>
          </div>
        </div>
      </Group>

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
    </div>
  )
}
