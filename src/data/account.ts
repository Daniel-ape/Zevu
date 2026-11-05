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
const SYNCED = ['lists', 'activeList', 'myStores', 'watched', 'cards', 'coupons', 'receipts', 'userPrices', 'lastStore', 'theme', 'lang', 'receiptLinks']
const META = 'hintaopas:sync-meta'
type Meta = Record<string, { t: number; h: string }>
type Remote = Record<string, { t: number; v: unknown }>

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h) }
const readMeta = (): Meta => { try { return JSON.parse(localStorage.getItem(META) || '{}') } catch { return {} } }
/** What is synced for a key: coupons go without their photos (too big; the coupon itself stays). */
function localValue(key: string): string | null {
  const raw = localStorage.getItem('hintaopas:' + key)
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
  return () => { clearTimeout(t0); clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
}
