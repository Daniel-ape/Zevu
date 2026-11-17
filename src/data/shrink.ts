import { useEffect, useState } from 'react'
import { fetchData } from './dataFile'
import type { Shrink } from '../domain/shrink'

// Products that came in a smaller pack at a higher price per kilo or litre
// (built by scripts/build-price-bundles.ts), loaded once when a product page
// first asks.
let list: Promise<Map<string, Shrink>> | null = null
const load = () => (list ??= fetchData<Shrink[]>('app/shrink.json').then((rows) => new Map((rows ?? []).map((r) => [r[0], r]))))

export function useShrink(ean: string | undefined): Shrink | undefined {
  const [s, setS] = useState<Shrink | undefined>()
  useEffect(() => {
    if (!ean) return
    let live = true
    load().then((m) => { if (live) setS(m.get(ean)) }).catch(() => {})
    return () => { live = false }
  }, [ean])
  return s
}

/** Every product found to have shrunk, newest first. */
export function useShrinks(): Shrink[] | null {
  const [list, setList] = useState<Shrink[] | null>(null)
  useEffect(() => {
    let live = true
    load().then((m) => { if (live) setList([...m.values()].sort((a, b) => b[5].localeCompare(a[5]))) }).catch(() => { if (live) setList([]) })
    return () => { live = false }
  }, [])
  return list
}
