// A search to show when the search tab opens, set from elsewhere in the app
// (the quick picks on an empty list). Taken once by the search screen.
let pending: string | null = null
export function searchFor(q: string) {
  pending = q
  window.dispatchEvent(new Event('zevu:search'))
}
export function takePendingSearch(): string | null {
  const q = pending
  pending = null
  return q
}
