// The phone's own text recognition gives back pieces of text with where they
// are in the picture. On a receipt the product name and its price are far
// apart on the same row, often as two pieces: this puts each row back
// together, left to right, so the receipt reads like the printed paper.

export interface OcrLine { text: string; x: number; y: number; w: number; h: number }

export function linesToText(lines: OcrLine[]): string {
  const ls = lines
    .filter((l) => l.text.trim() && l.h > 0)
    .map((l) => ({ ...l, cy: l.y + l.h / 2 }))
    .sort((a, b) => a.cy - b.cy)
  const rows: { cy: number; h: number; items: typeof ls }[] = []
  for (const l of ls) {
    // the row whose middle is nearest, if close enough (half a letter height)
    let best: (typeof rows)[number] | undefined
    for (let i = rows.length - 1; i >= 0 && i >= rows.length - 4; i--) {
      const r = rows[i]
      const d = Math.abs(l.cy - r.cy)
      if (d < Math.min(l.h, r.h) * 0.6 && !r.items.some((o) => overlaps(o, l)) && (!best || d < Math.abs(l.cy - best.cy))) best = r
    }
    if (best) {
      best.items.push(l)
      best.cy = best.items.reduce((a, o) => a + o.cy, 0) / best.items.length
      best.h = Math.max(best.h, l.h)
    } else rows.push({ cy: l.cy, h: l.h, items: [l] })
  }
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.text.trim()).join('   ')).join('\n')
}

/** Two pieces side by side overlap sideways: they belong on different rows. */
function overlaps(a: OcrLine, b: OcrLine) {
  return a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01
}
