// Sign in with Google (Supabase Auth) and keep the user's own things in sync between
// devices: lists, cards, coupons, receipts, watched products and settings. Everything
// still lives in the phone first (localStorage); a signed-in user also has one row in
// the `user_data` table, readable and writable only by that user (row level security).
//
// Configuration comes from the build: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// (GitHub secrets). The anon key is public by design; it only allows what the
// row level security rules in docs/supabase.sql allow. Without them, sign-in is hidden.
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { isNativeApp } from './openLink'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const accountsEnabled = !!(URL_ && KEY)

/** The phone app's own address scheme, so Google can hand the login back to the app. */
const APP_CALLBACK = 'fi.hintaopas.app://login'

let client: Promise<SupabaseClient> | null = null
function supabase(): Promise<SupabaseClient> {
  if (!accountsEnabled) return Promise.reject(new Error('accounts not configured'))
  return (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_!, KEY!, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isNativeApp } }),
  ))
}

/** Opens Google's sign-in. On the web the page comes back signed in; in the app the browser sheet returns to the app. */
export async function signInWithGoogle(): Promise<void> {
  const sb = await supabase()
  if (!isNativeApp) {
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
    return
  }
  const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_CALLBACK, skipBrowserRedirect: true } })
  if (error || !data.url) throw error ?? new Error('no sign-in address')
  const [{ Browser }, { App }] = await Promise.all([import('@capacitor/browser'), import('@capacitor/app')])
  await new Promise<void>((resolve, reject) => {
    let done = false
    App.addListener('appUrlOpen', async ({ url }) => {
      if (done || !url.startsWith(APP_CALLBACK)) return
      done = true
      await Browser.close().catch(() => {})
      const code = new URL(url).searchParams.get('code')
      if (!code) return reject(new Error('no code'))
      const { error } = await sb.auth.exchangeCodeForSession(code)
      error ? reject(error) : resolve()
    })
    Browser.open({ url: data.url, presentationStyle: 'popover' }).catch(reject)
  })
}

/**
 * When Google or Supabase sent the web page back with an error (?error=…), take
 * it out of the address and report it once, so the screen can say sign-in failed.
 */
let signInError: string | null | undefined
export function takeSignInError(): string | null {
  if (signInError !== undefined) { const e = signInError; signInError = null; return e }
  signInError = null
  try {
    const q = new URLSearchParams(location.search)
    const e = q.get('error_description') || q.get('error')
    if (!e) return null
    console.warn('sign-in failed:', e)
    history.replaceState(null, '', location.pathname + location.hash)
    return e
  } catch { return null }
}

/**
 * Deletes the account and everything stored with it: the synced data row and
 * the sign-in itself (the `delete_my_account` function in docs/supabase.sql).
 * Returns 'partial' when only the data could be removed (function missing).
 * The phone's own copy is left for the caller to clear or keep.
 */
export async function deleteAccount(): Promise<'done' | 'partial'> {
  const sb = await supabase()
  const { data } = await sb.auth.getSession()
  const user = data.session?.user
  if (!user) throw new Error('not signed in')
  const { error: rowErr } = await sb.from('user_data').delete().eq('user_id', user.id)
  if (rowErr) throw rowErr
  const { error } = await sb.rpc('delete_my_account')
  await sb.auth.signOut().catch(() => {})
  try { localStorage.removeItem('hintaopas:sync-meta') } catch { /* private mode */ }
  return error ? 'partial' : 'done'
}

export async function signOut() {
  const sb = await supabase()
  await sb.auth.signOut()
}

/** The signed-in user (or null), now and whenever it changes. */
export function onSession(cb: (s: Session | null) => void): () => void {
  if (!accountsEnabled) { cb(null); return () => {} }
  let stop = () => {}
  supabase().then((sb) => {
    sb.auth.getSession().then(({ data }) => cb(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s))
    stop = () => data.subscription.unsubscribe()
  })
  return () => stop()
}

// ---- Sync ----------------------------------------------------------------------------

/** The user's own things. Product data, prices and caches are not synced. */
const SYNCED = ['lists', 'activeList', 'myStores', 'watched', 'cards', 'coupons', 'receipts', 'userPrices', 'lastStore', 'theme', 'lang', 'receiptLinks',
  // products found by barcode or added by hand (so lists and watches show them on every phone),
  // recently viewed products, and which price alerts were already shown
  'remoteProducts', 'recent', 'alerted', 'alertedOffers']
/** Kept from both phones instead of the newer one winning. */
const MERGED = new Set(['remoteProducts', 'alerted', 'alertedOffers'])

/** Product ids the user's own things refer to. */
function referencedIds(): Set<string> {
  const ids = new Set<string>()
  const get = (k: string) => { try { return JSON.parse(localStorage.getItem('hintaopas:' + k) || 'null') } catch { return null } }
  for (const l of get('lists') ?? []) for (const i of l.items ?? []) ids.add(i.productId)
  for (const w of get('watched') ?? []) ids.add(w.productId)
  for (const r of get('receipts') ?? []) for (const i of r.items ?? []) if (i.productId) ids.add(i.productId)
  for (const p of get('userPrices') ?? []) ids.add(p.productId)
  for (const id of get('recent') ?? []) ids.add(id)
  return ids
}

/** Both sides together: lists of products by id, other lists as sets, objects key by key. */
function merge(local: unknown, remote: unknown): unknown {
  if (Array.isArray(local) && Array.isArray(remote)) {
    const key = (x: unknown) => (x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : JSON.stringify(x))
    const seen = new Set(local.map(key))
    return [...local, ...remote.filter((x) => !seen.has(key(x)))].slice(-500)
  }
  if (local && remote && typeof local === 'object' && typeof remote === 'object') return { ...(remote as object), ...(local as object) }
  return local ?? remote
}
const META = 'hintaopas:sync-meta'
type Meta = Record<string, { t: number; h: string }>
type Remote = Record<string, { t: number; v: unknown }>

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h) }
const readMeta = (): Meta => { try { return JSON.parse(localStorage.getItem(META) || '{}') } catch { return {} } }
/** What is synced for a key: coupons go without their photos (too big; the coupon itself stays). */
function localValue(key: string): string | null {
  const raw = localStorage.getItem('hintaopas:' + key)
  if (raw !== null && key === 'remoteProducts') {
    // only the products something refers to, not everything ever looked up
    try { const ids = referencedIds(); return JSON.stringify((JSON.parse(raw) as Array<{ id: string }>).filter((p) => ids.has(p.id))) } catch { return raw }
  }
  if (raw === null || key !== 'coupons') return raw
  try { return JSON.stringify((JSON.parse(raw) as Array<Record<string, unknown>>).map(({ image, ...c }) => c)) } catch { return raw }
}
/** Marks keys whose local value changed since the last sync with the current time. */
function touch(meta: Meta) {
  const now = Date.now()
  for (const k of SYNCED) {
    const v = localValue(k)
    if (v === null) continue
    const h = hash(v)
    if (meta[k]?.h !== h) meta[k] = { t: now, h }
  }
}

/**
 * Two-way sync: for each key the newer side wins. Returns true when local data
 * changed (the app then reloads to show it).
 */
export async function syncNow(): Promise<boolean> {
  const sb = await supabase()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return false
  const meta = readMeta()
  touch(meta)
  const { data: row, error } = await sb.from('user_data').select('data').eq('user_id', session.user.id).maybeSingle()
  if (error) throw error
  const remote: Remote = (row?.data as Remote) ?? {}
  let changedLocal = false
  const out: Remote = { ...remote }
  for (const k of SYNCED) {
    const r = remote[k], l = meta[k]
    if (r && MERGED.has(k)) {
      // union of both phones; send it back when this phone added something
      let local: unknown = null
      try { local = JSON.parse(localStorage.getItem('hintaopas:' + k) || 'null') } catch { /* unreadable: take remote */ }
      const merged = merge(local, r.v)
      const s = JSON.stringify(merged)
      if (localStorage.getItem('hintaopas:' + k) !== s) { localStorage.setItem('hintaopas:' + k, s); changedLocal = true }
      const v = localValue(k)
      const same = v !== null && v === JSON.stringify(r.v)
      meta[k] = { t: same ? r.t : Date.now(), h: hash(v ?? s) }
      if (!same && v !== null) out[k] = { t: meta[k].t, v: JSON.parse(v) }
      continue
    }
    if (r && (!l || r.t > l.t)) {
      // newer elsewhere: take it (coupons keep this phone's photos where the ids match)
      let v = r.v
      if (k === 'coupons') {
        try {
          const mine = JSON.parse(localStorage.getItem('hintaopas:coupons') || '[]') as Array<{ id: string; image?: string }>
          v = (v as Array<{ id: string }>).map((c) => ({ ...c, ...(mine.find((m) => m.id === c.id)?.image ? { image: mine.find((m) => m.id === c.id)!.image } : {}) }))
        } catch { /* keep remote as is */ }
      }
      const s = JSON.stringify(v)
      if (localStorage.getItem('hintaopas:' + k) !== s) { localStorage.setItem('hintaopas:' + k, s); changedLocal = true }
      meta[k] = { t: r.t, h: hash(localValue(k) ?? s) }
    } else if (l) {
      const v = localValue(k)
      if (v !== null) out[k] = { t: l.t, v: JSON.parse(v) }
    }
  }
  const { error: upErr } = await sb.from('user_data').upsert({ user_id: session.user.id, data: out, updated_at: new Date().toISOString() })
  if (upErr) throw upErr
  localStorage.setItem(META, JSON.stringify(meta))
  return changedLocal
}

/** Keeps syncing while signed in: soon after start, then every minute and when the app goes to the background. */
export function startAutoSync(onPulled: () => void): () => void {
  if (!accountsEnabled) return () => {}
  let busy = false
  const run = async () => {
    if (busy) return
    busy = true
    try { if (await syncNow()) onPulled() } catch { /* offline or signed out: try later */ } finally { busy = false }
  }
  const t0 = setTimeout(run, 1500)
  const iv = setInterval(run, 60_000)
  const vis = () => { if (document.visibilityState === 'hidden') run() }
  document.addEventListener('visibilitychange', vis)
  // a change (list, watch, coupon…) is sent a couple of seconds later
  let soon = 0
  const changed = () => { clearTimeout(soon); soon = window.setTimeout(run, 2500) }
  window.addEventListener('hintaopas:changed', changed)
  return () => { clearTimeout(t0); clearTimeout(soon); clearInterval(iv); document.removeEventListener('visibilitychange', vis); window.removeEventListener('hintaopas:changed', changed) }
}
