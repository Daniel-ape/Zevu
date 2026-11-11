// How strong the phone is. On cheaper phones (little memory or few processor
// cores, which Android reports) the app turns off its most expensive effects:
// the blurred glass behind bars and sheets and the page slide animations.
// Everything else works the same. The class "lite" on <html> drives the CSS.
type Nav = Navigator & { deviceMemory?: number }

export const lite = (() => {
  if (typeof navigator === 'undefined') return false
  const n = navigator as Nav
  if (/[?&]lite\b/.test(location.search)) return true
  const android = /Android/i.test(n.userAgent)
  const memory = n.deviceMemory // GB, rounded (Chrome/Android only)
  const cores = n.hardwareConcurrency || 8
  return android ? (memory !== undefined && memory <= 4) || cores <= 4 : (memory !== undefined && memory <= 2)
})()

if (lite) document.documentElement.classList.add('lite')
