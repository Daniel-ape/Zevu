import { useState, type ReactNode } from 'react'
import { useStore, type Theme } from '../data/store'
import { euro } from '../domain/pricing'
import { retailerName, type Receipt } from '../domain/receipts'
import { LANGS, LOCALE } from '../i18n'
import { Chevron, Plus } from '../ui/icons'
import { ReceiptSheet } from './ReceiptSheet'

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="group">
      <div className="group-title">{title}</div>
      <div className="group-body">{children}</div>
      {note && <p className="group-note">{note}</p>}
    </section>
  )
}

export function Profile() {
  const { theme, setTheme, programs, memberships, toggleMembership, lang, setLang, receipts, retailers, t } = useStore()
  const [sheet, setSheet] = useState<{ receipt?: Receipt } | null>(null)

  return (
    <div className="screen">
      <div className="topbar"><h1>{t('you.title')}</h1></div>

      <Group title={t('you.groupCards')} note={t('you.cardsNote')}>
        {programs.map((p) => {
          const on = memberships.includes(p.chain)
          return (
            <label key={p.chain} className="row" style={{ cursor: 'pointer' }}>
              <div className="grow">
                <div className="title">{p.name}</div>
                <div className="sub">{on ? t('you.cardOn') : p.stores}</div>
              </div>
              <input type="checkbox" className="switch" checked={on} onChange={() => toggleMembership(p.chain)} aria-label={p.name} />
            </label>
          )
        })}
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
              <div className="title">{retailerName(r, retailers)}</div>
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
            <div className="sub" style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>{t('you.dataNote')} {t('you.cardsLimit')} {t('about.off')}</div>
          </div>
        </div>
      </Group>

      {sheet && <ReceiptSheet receipt={sheet.receipt} onClose={() => setSheet(null)} />}
    </div>
  )
}
