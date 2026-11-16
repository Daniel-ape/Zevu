// Shared shopping lists: everyone with a list's code sees and changes the same
// list. The list lives in the shared_lists table and is reached only through
// the share_list_get / share_list_put functions (docs/supabase.sql), which
// need the long random code. Each phone keeps its own copy and a snapshot of
// what it last synced ("base"), so changes made on two phones at once are
// merged item by item instead of one overwriting the other.
import type { ShoppingList, ShoppingListItem } from '../domain/types'
import { accountsEnabled, supabaseClient } from './account'
import { itemsEqual, mergeItems } from '../domain/listMerge'
export { itemsEqual, mergeItems }

export const sharingEnabled = accountsEnabled

export interface ShareState { code: string; v: number; base: ShoppingListItem[] }
type Remote = { name: string; items: ShoppingListItem[] }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I
export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}
export const prettyCode = (c: string) => c.replace(/(.{5})(?=.)/g, '$1-')
export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const inviteUrl = (code: string) => `https://daniel-ape.github.io/Zevu/lista.html?c=${code}`

const strip = (items: ShoppingListItem[]) => items.map(({ productId, quantity, checked }) => ({ productId, quantity, ...(checked ? { checked: true } : {}) }))

async function get(code: string): Promise<{ data: Remote; version: number } | null> {
  const sb = await supabaseClient()
  const { data, error } = await sb.rpc('share_list_get', { p_code: code })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return { data: row.data as Remote, version: row.version as number }
}

async function put(code: string, data: Remote, base: number): Promise<number> {
  const sb = await supabaseClient()
  const { data: v, error } = await sb.rpc('share_list_put', { p_code: code, p_data: data, p_base: base })
  if (error) throw error
  return v as number
}

/** Starts sharing a list: stores it under a new code. */
export async function startSharing(list: ShoppingList, name: string): Promise<ShareState> {
  for (let tries = 0; tries < 3; tries++) {
    const code = newCode()
    const items = strip(list.items)
    const v = await put(code, { name, items }, 0)
    if (v > 0) return { code, v, base: items }
  }
  throw new Error('no free code')
}

/** Loads a shared list by its code, to join it. */
export async function fetchShared(code: string): Promise<{ name: string; share: ShareState; items: ShoppingListItem[] } | null> {
  const r = await get(code)
  if (!r) return null
  const items = strip(r.data.items ?? [])
  return { name: r.data.name ?? '', share: { code, v: r.version, base: items }, items }
}

/**
 * Brings one shared list up to date in both directions. Returns the list's new
 * items and share state, or null when nothing changed.
 */
export async function syncShared(list: ShoppingList & { shared: ShareState }, name: string): Promise<{ items: ShoppingListItem[]; shared: ShareState } | null> {
  const { code } = list.shared
  let { v, base } = list.shared
  let local = strip(list.items)
  for (let round = 0; round < 4; round++) {
    const changedHere = !itemsEqual(local, base)
    if (changedHere) {
      const nv = await put(code, { name, items: local }, v)
      if (nv > 0) return { items: list.items, shared: { code, v: nv, base: local } }
    }
    // someone else changed it (or we only need to look): fetch and merge
    const r = await get(code)
    if (!r) return null
    if (r.version === v && !changedHere) return null
    const remote = strip(r.data.items ?? [])
    const merged = mergeItems(base, local, remote)
    v = r.version
    base = remote
    if (itemsEqual(merged, remote)) return { items: merged, shared: { code, v, base } }
    local = merged // our changes on top of theirs: save again
  }
  return null
}
