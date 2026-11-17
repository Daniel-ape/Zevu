import { useState } from 'react'
import { setBudget, useBudget } from '../data/budget'
import { useStore } from '../data/store'
import { parseEuros } from '../domain/budget'
import { euro } from '../domain/pricing'
import { Sheet } from './Sheet'

/** This month against the budget: a bar, what's left, days left and the pace. */
export function BudgetCard() {
  const { t } = useStore()
  const { budget, status } = useBudget()
  const [editing, setEditing] = useState(false)

  return (
    <>
      {status ? (
        <button className={'bud-card ' + status.level} onClick={() => setEditing(true)}>
          <div className="bud-top">
            <span className="bud-title">{t('bud.title')}</span>
            <span className="bud-edit">{t('bud.edit')}</span>
          </div>
          <div className="bud-nums">
            <b>{status.leftCents >= 0 ? t('bud.left', { amount: euro(status.leftCents) }) : t('bud.overBy', { amount: euro(-status.leftCents) })}</b>
            <span>{t('bud.of', { spent: euro(status.spentCents), budget: euro(status.budgetCents) })}</span>
          </div>
          <div className="bud-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, status.used) * 100)}>
            <i style={{ transform: `scaleX(${Math.min(1, status.used)})` }} />
          </div>
          <div className="bud-foot">
            <span>{status.daysLeft === 1 ? t('bud.daysLeft1') : t('bud.daysLeft', { n: status.daysLeft })}</span>
            {status.projectedCents != null && <span>{t('bud.pace', { amount: `${Math.round(status.projectedCents / 100)} €` })}</span>}
          </div>
        </button>
      ) : (
        <button className="bud-card empty" onClick={() => setEditing(true)}>
          <span className="bud-plus" aria-hidden>+</span>
          <span><b>{t('bud.set')}</b><span className="bud-hint">{t('bud.setHint')}</span></span>
        </button>
      )}
      {editing && <BudgetSheet current={budget} onClose={() => setEditing(false)} />}
    </>
  )
}

function BudgetSheet({ current, onClose }: { current: number | null; onClose: () => void }) {
  const { t } = useStore()
  const [text, setText] = useState(current ? String(Math.round(current / 100)) : '')
  const [bad, setBad] = useState(false)
  const save = () => {
    const c = parseEuros(text)
    if (!c) return setBad(true)
    setBudget(c)
    onClose()
  }
  return (
    <Sheet title={t('bud.title')} onClose={onClose} closeLabel={t('common.cancel')}>
      <form className="share-list" onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className="fb-hint">{t('bud.setHint')}</p>
        <label className="bud-input">
          <input inputMode="decimal" autoFocus value={text} placeholder="400" aria-label={t('bud.amount')}
            onChange={(e) => { setText(e.target.value); setBad(false) }} />
          <span>€ / {t('bud.month')}</span>
        </label>
        <div className="chips wrap">
          {[200, 300, 400, 600, 800].map((v) => (
            <button type="button" key={v} className={'chip' + (text === String(v) ? ' on' : '')} onClick={() => { setText(String(v)); setBad(false) }}>{v} €</button>
          ))}
        </div>
        {bad && <p className="fb-err">{t('bud.invalid')}</p>}
        <button className="btn primary" type="submit">{t('bud.save')}</button>
        {current && <button type="button" className="btn ghost" onClick={() => { setBudget(null); onClose() }}>{t('bud.remove')}</button>}
        <p className="fb-note">{t('bud.fromReceipts')}</p>
      </form>
    </Sheet>
  )
}

/** A thin bar for the home card, when a budget is set. */
export function BudgetMini() {
  const { t } = useStore()
  const { status } = useBudget()
  if (!status) return null
  return (
    <span className={'bud-mini ' + status.level}>
      <span className="bud-mini-row"><span>{t('bud.chip')}</span><b>{t('bud.of', { spent: euro(status.spentCents), budget: euro(status.budgetCents) })}</b></span>
      <span className="bud-bar"><i style={{ transform: `scaleX(${Math.min(1, status.used)})` }} /></span>
    </span>
  )
}
