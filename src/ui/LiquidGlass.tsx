import { useEffect, useState, type CSSProperties, type RefObject } from 'react'

/*
 * Liquid Glass refraction, the technique used by the web recreations of Apple's
 * material: a displacement map shaped like the element (a rounded capsule with a
 * convex bevel) is fed to <feDisplacementMap>, and the filter is applied as a
 * backdrop-filter. Content behind the edge of the glass is bent towards the
 * centre (lensing) and the red, green and blue channels are bent by slightly
 * different amounts (chromatic aberration).
 *
 * SVG filters inside backdrop-filter only work in Chromium (Chrome, Edge and the
 * Android WebView). Safari / iOS WebView ignore them, so there we keep the CSS
 * glass from styles.css instead.
 */

export const canRefract = (() => {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false
  // ?glass=css shows the Safari version in any browser (for testing).
  if (typeof location !== 'undefined' && location.search.includes('glass=css')) return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || /Firefox\//.test(ua)) return false
  if (!/Chrome\/|Chromium\//.test(ua)) return false
  return CSS.supports('backdrop-filter', 'blur(1px)')
})()

/** Builds an RGB displacement map (R = x, G = y, 128 = no shift) for a rounded rect. */
function displacementMap(w: number, h: number, radius: number, bezel: number): string {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(w, h)
  const r = Math.min(radius, w / 2, h / 2)
  const hx = w / 2 - r, hy = h / 2 - r
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2
      const qx = Math.abs(px) - hx, qy = Math.abs(py) - hy
      // signed distance to the rounded rect edge (negative inside)
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0)
      const sdf = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
      const inside = -sdf
      // outward normal
      let nx = 0, ny = 0
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = qx / l; ny = qy / l }
      else if (qx > qy) nx = 1
      else ny = 1
      nx *= Math.sign(px) || 1; ny *= Math.sign(py) || 1
      let mag = 0
      if (inside > 0 && inside < bezel) {
        // convex "squircle" bevel: steep at the rim, flat towards the middle
        const t = 1 - inside / bezel
        mag = Math.pow(t, 2.2)
      } else if (inside <= 0) mag = 1
      const i = (y * w + x) * 4
      // sample inwards: shift = -normal * mag
      img.data[i] = Math.round(128 - nx * mag * 127)
      img.data[i + 1] = Math.round(128 - ny * mag * 127)
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

type Size = { w: number; h: number }

/**
 * Attach to a glass element. Returns the style to apply and an <svg> holding
 * the element's own filter (its size must match the element).
 */
export function useLiquidGlass(id: string, ref: RefObject<HTMLElement | null>, opts: { bezel?: number; scale?: number } = {}) {
  const [size, setSize] = useState<Size | null>(null)
  const [map, setMap] = useState('')
  const bezel = opts.bezel ?? 16
  const scale = opts.scale ?? 26

  useEffect(() => {
    if (!canRefract || !ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight)
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  useEffect(() => {
    if (!size || size.w < 4 || size.h < 4) return
    setMap(displacementMap(size.w, size.h, size.h / 2, Math.min(bezel, size.h / 2)))
  }, [size, bezel])

  const active = canRefract && !!map && !!size
  const style: CSSProperties | undefined = active
    ? { backdropFilter: `url(#${id})`, WebkitBackdropFilter: `url(#${id})` }
    : undefined

  const svg = active ? (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
      <filter id={id} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="src" />
        <feImage href={map} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
        {/* one bend per colour channel: red bends least, blue most */}
        <feDisplacementMap in="src" in2="map" scale={scale * 0.95} xChannelSelector="R" yChannelSelector="G" result="dR" />
        <feDisplacementMap in="src" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="dG" />
        <feDisplacementMap in="src" in2="map" scale={scale * 1.05} xChannelSelector="R" yChannelSelector="G" result="dB" />
        <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feBlend in="r" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b" mode="screen" result="rgb" />
        <feColorMatrix in="rgb" type="saturate" values="1.5" />
      </filter>
    </svg>
  ) : null

  return { style, svg, active }
}
