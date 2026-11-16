// "Wrong price?" on a product and "Send feedback" in You: a short message
// stored in the feedback table (docs/supabase.sql). Anyone can send; nobody
// can read the messages through the app.
import { accountsEnabled, supabaseClient } from './account'

export type FeedbackKind = 'price' | 'picture' | 'name' | 'other' | 'general'

export const feedbackEnabled = accountsEnabled

export async function sendFeedback(f: { kind: FeedbackKind; message: string; productId?: string; productName?: string }): Promise<void> {
  const sb = await supabaseClient()
  const app = `${navigator.userAgent.includes('Android') ? 'android' : /iPhone|iPad/.test(navigator.userAgent) ? 'ios' : 'web'} ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`.trim()
  const { error } = await sb.from('feedback').insert({
    kind: f.kind,
    message: f.message.trim().slice(0, 2000),
    product_id: f.productId ?? null,
    product_name: f.productName?.slice(0, 200) ?? null,
    app: app.slice(0, 80),
  })
  if (error) throw error
}
