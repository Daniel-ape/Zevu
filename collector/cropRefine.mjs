// Finds the whole offer box on a leaflet page picture. Starting from the price and
// the product name, each side moves outwards until it meets the box's edge: a
// straight colour change running along it (Lidl's coloured panels, Minimani's
// black boxes), or a band of empty background between offers (Rusta's white
// pages). It never goes past `region`, the most the offer can cover.
// img: { w, h, data } with RGB bytes; boxes are [left, top, width, height] as parts of the page.

/** P6 PPM (pdftoppm output) → { w, h, data } */
export function readPpm(buf) {
  let i = 0
  const tok = () => {
    while (/\s/.test(String.fromCharCode(buf[i]))) i++
    if (buf[i] === 35) { while (buf[i] !== 10) i++; return tok() }
    let s = ''
    while (!/\s/.test(String.fromCharCode(buf[i]))) s += String.fromCharCode(buf[i++])
    return s
  }
  if (tok() !== 'P6') throw new Error('not P6')
  const w = +tok(), h = +tok(); tok(); i++
  return { w, h, data: buf.subarray(i, i + w * h * 3) }
}

export function refineCrop(img, region, seed) {
  const { w: W, h: H, data } = img
  const px = (x, y) => { const k = (y * W + x) * 3; return [data[k], data[k + 1], data[k + 2]] }
  const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  const R = { x0: Math.floor(region[0] * W), y0: Math.floor(region[1] * H), x1: Math.min(W - 1, Math.ceil((region[0] + region[2]) * W)), y1: Math.min(H - 1, Math.ceil((region[1] + region[3]) * H)) }
  const S = {
    x0: Math.max(R.x0, Math.floor(seed[0] * W)), y0: Math.max(R.y0, Math.floor(seed[1] * H)),
    x1: Math.min(R.x1, Math.ceil((seed[0] + seed[2]) * W)), y1: Math.min(R.y1, Math.ceil((seed[1] + seed[3]) * H)),
  }
  const gap = Math.max(3, Math.round(H * 0.012)) // empty band that separates offers

  // A line (row or column) across [a, b] at position t.
  const line = (horizontal, t, a, b) => { const out = []; for (let s = a; s <= b; s++) out.push(horizontal ? px(s, t) : px(t, s)); return out }
  const uniform = (ps) => {
    const m = [0, 1, 2].map((c) => ps.reduce((s, p) => s + p[c], 0) / ps.length)
    return ps.filter((p) => diff(p, m) > 40).length < ps.length * 0.04 ? m : null
  }
  /**
   * Moves one side outwards from `from` towards `limit` (step ±1) and returns where the box
   * ends. First choice: a straight border – the colour is steady just inside it and changes
   * sharply across it along most of the side (a photo's own outline is not steady). Otherwise
   * a band of plain background, the space between two offers.
   */
  function edge(horizontal, from, limit, step, a, b) {
    const L = (t) => line(horizontal, Math.min(Math.max(t, 0), horizontal ? H - 1 : W - 1), a, b)
    // start a little inside the box: the text's box can reach just past a border
    for (let t = from - step * 4; step > 0 ? t <= limit - step : t >= limit - step; t += step) {
      const in2 = L(t - step * 2), in1 = L(t - step), out = L(t + step)
      const hits = in1.filter((p, k) => diff(p, in2[k]) < 35 && diff(p, out[k]) > 80).length
      if (hits > in1.length * 0.62) return { t, hit: true }
    }
    let run = 0, color = null
    for (let t = from + step; step > 0 ? t <= limit : t >= limit; t += step) {
      // only white or near-white space counts as a gap (inside coloured panels a plain area is part of the offer)
      const u0 = uniform(L(t)), u = u0 && Math.min(...u0) > 215 ? u0 : null
      if (u && (!color || diff(u, color) < 30)) { run++; color = u; if (run >= gap) return { t: t - step * gap, hit: true } }
      else { run = 0; color = null }
    }
    return { t: limit, hit: false }
  }
  // Grow a few rounds, since a wider box can reveal more of the photo above it.
  // A side that has found its border stays there.
  let B = { ...S }
  const done = {}
  for (let round = 0; round < 3; round++) {
    const step = (side, horizontal, from, limit, dir, a, b) => {
      if (done[side]) return from
      const e = edge(horizontal, from, limit, dir, a, b)
      if (e.hit) done[side] = true
      return e.t
    }
    const nb = {
      y0: step('y0', true, B.y0, R.y0, -1, B.x0, B.x1),
      y1: step('y1', true, B.y1, R.y1, 1, B.x0, B.x1),
      x0: step('x0', false, B.x0, R.x0, -1, B.y0, B.y1),
      x1: step('x1', false, B.x1, R.x1, 1, B.y0, B.y1),
    }
    const same = nb.x0 === B.x0 && nb.x1 === B.x1 && nb.y0 === B.y0 && nb.y1 === B.y1
    B = nb
    if (same) break
  }
  const pad = Math.round(W * 0.008)
  const x0 = Math.max(0, B.x0 - pad), y0 = Math.max(0, B.y0 - pad), x1 = Math.min(W, B.x1 + pad), y1 = Math.min(H, B.y1 + pad)
  const r = (v) => Math.round(v * 1000) / 1000
  return [r(x0 / W), r(y0 / H), r((x1 - x0) / W), r((y1 - y0) / H), region[4]]
}
