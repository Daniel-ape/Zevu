// Where the shared data folders (prices/, products/, logos/) are. The web app
// lives at /hintaopas/app/ under the ZEVU homepage, while the data stays at
// /hintaopas/ (the installed app reads its live prices from there too), so the
// web build sets VITE_DATA_BASE to '../'. Elsewhere the data sits next to the app.
const BASE = (import.meta.env.VITE_DATA_BASE as string | undefined) ?? ''

export function dataUrl(path: string): string {
  return new URL(BASE + path, location.href).href
}
