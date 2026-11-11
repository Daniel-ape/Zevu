// Sharing receipt prices with Open Prices (prices.openfoodfacts.org), the open
// price database run by Open Food Facts. Every shared receipt makes the shop's
// prices visible to everyone, ZEVU included, for shops whose prices can't be
// read from their websites (S-market, Prisma, K-shops).
//
// The user signs in with their own Open Food Facts account. The password goes
// straight to Open Food Facts and is never stored; only the session token is
// kept on this phone (not synced to the ZEVU account).
import { Capacitor, CapacitorHttp } from '@capacitor/core'

const API = 'https://prices.openfoodfacts.org/api/v1'
const KEY = 'zevu:openPrices'
const APP = 'app_name=ZEVU'

export type OpenPricesLogin = { user: string; token: string }

export function openPricesLogin(): OpenPricesLogin | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export function openPricesLogout() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  dispatchEvent(new Event('zevu:openprices'))
}

type Res = { status: number; data: unknown }
const native = Capacitor.isNativePlatform()

// On the phone the request goes through the app itself (no cross-site rules);
// in a browser it is an ordinary request.
async function call(method: 'GET' | 'POST', path: string, opts: { token?: string; json?: unknown; form?: Record<string, string>; multipart?: { fields: Record<string, string>; file: { key: string; blob: Blob; name: string } } }): Promise<Res> {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}${APP}`
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (native) {
    if (opts.multipart) {
      const b64 = await blobToBase64(opts.multipart.file.blob)
      const data = [
        ...Object.entries(opts.multipart.fields).map(([key, value]) => ({ key, value, type: 'string' })),
        { key: opts.multipart.file.key, value: b64, type: 'base64File', contentType: opts.multipart.file.blob.type || 'image/jpeg', fileName: opts.multipart.file.name },
      ]
      const r = await CapacitorHttp.request({ url, method, headers: { ...headers, 'Content-Type': 'multipart/form-data' }, data, dataType: 'formData' })
      return { status: r.status, data: r.data }
    }
    if (opts.form) {
      const r = await CapacitorHttp.request({ url, method, headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, data: opts.form })
      return { status: r.status, data: r.data }
    }
    const r = await CapacitorHttp.request({ url, method, headers: { ...headers, 'Content-Type': 'application/json' }, data: opts.json })
    return { status: r.status, data: r.data }
  }
  let body: BodyInit | undefined
  if (opts.multipart) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(opts.multipart.fields)) fd.append(k, v)
    fd.append(opts.multipart.file.key, opts.multipart.file.blob, opts.multipart.file.name)
    body = fd
  } else if (opts.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(opts.form).toString()
  } else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }
  const r = await fetch(url, { method, headers, body })
  return { status: r.status, data: await r.json().catch(() => null) }
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '')
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(b)
  })
}

/** Signs in with an Open Food Facts account. Throws 'wrong' for a bad user name or password. */
export async function signInOpenPrices(user: string, password: string): Promise<void> {
  const r = await call('POST', '/auth', { form: { username: user.trim(), password } })
  const token = (r.data as { access_token?: string } | null)?.access_token
  if (r.status === 401 || r.status === 403 || (r.status < 300 && !token)) throw new Error('wrong')
  if (r.status >= 300 || !token) throw new Error('offline')
  try { localStorage.setItem(KEY, JSON.stringify({ user: user.trim(), token })) } catch { /* ignore */ }
  dispatchEvent(new Event('zevu:openprices'))
}

/** A shop as Open Prices knows it: an OpenStreetMap place. */
export type OsmPlace = { type: 'NODE' | 'WAY' | 'RELATION'; id: number }

export interface ShareInput {
  photo: Blob
  date: string // ISO
  place: OsmPlace
  totalCents: number | null
  /** One line per product with a barcode; price per item. */
  items: { ean: string; unitCents: number; quantity: number; name: string }[]
}

/** Uploads the receipt photo as proof, then one price per product. Returns how many prices were added. */
export async function shareReceipt(input: ShareInput): Promise<number> {
  const login = openPricesLogin()
  if (!login) throw new Error('signin')
  const date = input.date.slice(0, 10)
  const proof = await call('POST', '/proofs/upload', {
    token: login.token,
    multipart: {
      fields: {
        type: 'RECEIPT', currency: 'EUR', date,
        location_osm_id: String(input.place.id), location_osm_type: input.place.type,
        receipt_price_count: String(input.items.length),
        ...(input.totalCents != null ? { receipt_price_total: (input.totalCents / 100).toFixed(2) } : {}),
      },
      file: { key: 'file', blob: input.photo, name: 'receipt.jpg' },
    },
  })
  if (proof.status === 401 || proof.status === 403) { openPricesLogout(); throw new Error('signin') }
  const proofId = (proof.data as { id?: number } | null)?.id
  if (proof.status >= 300 || !proofId) throw new Error('upload')
  let added = 0
  for (const it of input.items) {
    const r = await call('POST', '/prices', {
      token: login.token,
      json: {
        type: 'PRODUCT', product_code: it.ean, price: Math.round(it.unitCents) / 100, currency: 'EUR', date,
        location_osm_id: input.place.id, location_osm_type: input.place.type, proof_id: proofId,
        receipt_quantity: it.quantity,
      },
    }).catch(() => ({ status: 0, data: null }))
    if (r.status >= 200 && r.status < 300) added++
  }
  return added
}
