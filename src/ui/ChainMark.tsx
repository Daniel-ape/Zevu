import { useEffect, useState } from 'react'
import { CARD_CHAINS } from '../data/cards'
import { dataUrl } from '../data/dataUrl'

let logoIndex: Promise<Record<string, string>> | null = null
const loadLogos = () =>
  (logoIndex ??= fetch(dataUrl('logos/index.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<Record<string, string>>)

/** URL of a chain's logo, or null while unknown / when there is none. */
export function useLogo(chain: string): string | null {
  const [logo, setLogo] = useState<string | null>(null)
  useEffect(() => { loadLogos().then((i) => setLogo(i[chain] ? dataUrl('logos/' + i[chain]) : null)) }, [chain])
  return logo
}

/** The store's own logo in the corner of an offer picture (its name in its colour if there is no logo). */
export function ChainMark({ chain, label, inline }: { chain: string; label?: string; inline?: boolean }) {
  const c = CARD_CHAINS.find((x) => x.id === chain)
  const [logo, setLogo] = useState<string | null>(null)
  const [bad, setBad] = useState(false)
  const [wide, setWide] = useState(false)
  useEffect(() => { loadLogos().then((i) => setLogo(i[chain] ? dataUrl('logos/' + i[chain]) : null)) }, [chain])
  const name = label || (c?.name || chain).replace(/ Plus$/, '')
  if (logo && !bad)
    return (
      <span className={'chain-logo' + (wide ? ' wide' : '') + (inline ? ' inline' : '')}>
        <img src={logo} alt={name} onError={() => setBad(true)} onLoad={(e) => setWide(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight * 1.6)} />
      </span>
    )
  if (inline) return null
  return <span className="chain-mark" style={{ background: c?.color ?? '#6b6b78' }}>{name}</span>
}

