// Reads the text of a receipt photo on the device (Tesseract, Finnish +
// Swedish). The engine and language data ship with the app under /ocr and
// load only the first time a photo is scanned. Photos never leave the phone.

import type { Worker } from 'tesseract.js'

let worker: Promise<Worker> | null = null

function asset(path: string) {
  return new URL(path, location.href).href
}

// The language data ships as .js files (base64). This small bootstrap runs
// inside the OCR worker and answers Tesseract's request for the language file
// from those, so nothing is fetched from outside the app.
function bootstrapUrl() {
  const base = asset('ocr/')
  const src = `
    const base = ${JSON.stringify(base)};
    const realFetch = self.fetch.bind(self);
    self.fetch = (url, opts) => {
      const m = String(url).match(/\\/(fin|swe)\\.traineddata\\.gz$/);
      if (!m) return realFetch(url, opts);
      importScripts(base + 'lang/' + m[1] + '.js');
      const bin = atob(self['LANG_' + m[1]]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      delete self['LANG_' + m[1]];
      return Promise.resolve(new Response(bytes));
    };
    importScripts(base + 'worker.min.js');
  `
  return URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
}

async function getWorker(onProgress: (p: number) => void) {
  const { createWorker, OEM } = await import('tesseract.js')
  worker ??= createWorker(['fin', 'swe'], OEM.LSTM_ONLY, {
    workerPath: bootstrapUrl(),
    workerBlobURL: false,
    corePath: asset('ocr/'),
    langPath: asset('ocr/lang'),
    gzip: true,
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(m.progress)
    },
  }).catch((e) => {
    worker = null
    throw e
  })
  return worker
}

/** Shelf labels: just downscale (colour photo in good light). */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 2200 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c
}

const grey = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]

/** Otsu's threshold of a grey histogram. */
function otsu(hist: number[], total: number) {
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, best = 0, t = 128
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue
    const wF = total - wB; if (!wF) break
    sumB += i * hist[i]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; t = i }
  }
  return t
}

/**
 * Where the receipt is in the photo: the paper is the bright part. Rows and
 * columns that are mostly bright give its bounding box (with a small margin).
 */
function paperBox(img: ImageBitmap) {
  const W = 400, H = Math.max(1, Math.round((img.height / img.width) * W))
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const hist = new Array(256).fill(0)
  const v = new Uint8Array(W * H)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { v[p] = grey(d, i); hist[v[p]]++ }
  const t = otsu(hist, W * H)
  const colOn = new Array(W).fill(0), rowOn = new Array(H).fill(0)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (v[y * W + x] > t) { colOn[x]++; rowOn[y]++ }
  const span = (a: number[], n: number, min: number) => {
    let lo = 0, hi = a.length - 1
    while (lo < hi && a[lo] < n * min) lo++
    while (hi > lo && a[hi] < n * min) hi--
    return [lo, hi]
  }
  const [x0, x1] = span(colOn, H, 0.25)
  const [y0, y1] = span(rowOn, W, 0.15)
  const k = img.width / W
  const mx = (x1 - x0) * 0.03, my = (y1 - y0) * 0.01
  const box = { x: Math.max(0, (x0 - mx) * k), y: Math.max(0, (y0 - my) * k), w: Math.min(img.width, (x1 - x0 + 2 * mx) * k), h: Math.min(img.height, (y1 - y0 + 2 * my) * k) }
  // Nothing sensible found (e.g. a screenshot or a scan): use the whole image.
  return box.w < img.width * 0.2 || box.h < img.height * 0.2 ? { x: 0, y: 0, w: img.width, h: img.height } : box
}

/**
 * Black text on white, decided locally (Bradley's adaptive threshold with an
 * integral image): copes with shadows, uneven light and faded thermal paper.
 */
function binarize(c: HTMLCanvasElement, strength = 0.12) {
  const W = c.width, H = c.height
  const g = c.getContext('2d', { willReadFrequently: true })!
  const img = g.getImageData(0, 0, W, H)
  const d = img.data
  const v = new Float32Array(W * H)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) v[p] = grey(d, i)
  const I = new Float64Array((W + 1) * (H + 1))
  for (let y = 1; y <= H; y++) {
    let row = 0
    for (let x = 1; x <= W; x++) { row += v[(y - 1) * W + x - 1]; I[y * (W + 1) + x] = I[(y - 1) * (W + 1) + x] + row }
  }
  const r = Math.max(8, Math.round(W / 24))
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1)
      const n = (x1 - x0) * (y1 - y0)
      const sum = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]
      const on = v[y * W + x] < (sum / n) * (1 - strength)
      const o = (y * W + x) * 4
      d[o] = d[o + 1] = d[o + 2] = on ? 0 : 255
    }
  }
  g.putImageData(img, 0, 0)
}

/** The skew angle (degrees) at which text rows line up best (sharpest row profile). */
function skewOf(c: HTMLCanvasElement) {
  const W = 300, H = Math.max(1, Math.round((c.height / c.width) * W))
  const s = document.createElement('canvas'); s.width = W; s.height = H
  const g = s.getContext('2d', { willReadFrequently: true })!
  g.drawImage(c, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const pts: [number, number][] = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] < 128) pts.push([x - W / 2, y])
  if (pts.length < 50) return 0
  let best = 0, bestScore = -1
  for (let a = -7; a <= 7; a += 0.5) {
    const t = Math.tan((a * Math.PI) / 180)
    const rows = new Float64Array(H + W)
    for (const [x, y] of pts) { const r = Math.round(y - x * t + W / 2); if (r >= 0 && r < rows.length) rows[r]++ }
    let score = 0
    for (let i = 1; i < rows.length; i++) score += (rows[i] - rows[i - 1]) ** 2
    if (score > bestScore) { bestScore = score; best = a }
  }
  return best
}

/**
 * Receipt photo → clean black-on-white image at a size Tesseract reads well:
 * crop to the paper, scale by the paper's width (so a long receipt doesn't end
 * up with tiny letters), straighten, then adaptive threshold.
 */
async function prepareReceipt(file: File, strength = 0.12): Promise<HTMLCanvasElement> {
  const img = await createImageBitmap(file)
  const box = paperBox(img)
  // ~1500 px across the receipt; limited so huge photos stay fast.
  let scale = Math.min(3, 1500 / box.w)
  scale = Math.min(scale, Math.sqrt(14e6 / (box.w * box.h)))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(box.w * scale))
  c.height = Math.max(1, Math.round(box.h * scale))
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height)
  binarize(c, strength)
  const angle = skewOf(c)
  if (Math.abs(angle) < 0.4) return c
  const r = document.createElement('canvas'); r.width = c.width; r.height = c.height
  const rg = r.getContext('2d')!
  rg.fillStyle = '#fff'; rg.fillRect(0, 0, r.width, r.height)
  rg.translate(r.width / 2, r.height / 2); rg.rotate((-angle * Math.PI) / 180); rg.drawImage(c, -c.width / 2, -c.height / 2)
  return r
}

/** How usable a read is: items found, and a total that matches them. */
function score(text: string, judge?: (text: string) => number) {
  if (judge) return judge(text)
  return (text.match(/\d+[,.]\d{2}\b/g) ?? []).length
}

/**
 * Text of a receipt photo. Reads the cleaned image as one column of text; if
 * that finds little, tries again with a lighter threshold and the "uniform
 * block" layout and keeps whichever read scores better.
 */
export async function photoToText(file: File, onProgress: (p: number) => void = () => {}, judge?: (text: string) => number): Promise<string> {
  const w = await getWorker(onProgress)
  await w.setParameters({ tessedit_pageseg_mode: '4' as never, preserve_interword_spaces: '1' as never })
  try {
    const first = (await w.recognize(await prepareReceipt(file))).data.text
    const s1 = score(first, judge)
    if (s1 >= 6) return first
    await w.setParameters({ tessedit_pageseg_mode: '6' as never })
    const second = (await w.recognize(await prepareReceipt(file, 0.06))).data.text
    return score(second, judge) > s1 ? second : first
  } finally {
    await w.setParameters({ tessedit_pageseg_mode: '3' as never, preserve_interword_spaces: '0' as never })
  }
}

export interface OcrWord { text: string; height: number; line: string }

/** Words with their size, so the big price on a shelf label can be told apart from small print. */
export async function photoToWords(file: File, onProgress: (p: number) => void = () => {}): Promise<OcrWord[]> {
  // Labels are photographed in colour and good light: skip the receipt contrast boost.
  const w = await getWorker(onProgress)
  const canvas = await prepare(file)
  // Labels are scattered text, not lines of prose: use "sparse text" layout, then switch back.
  await w.setParameters({ tessedit_pageseg_mode: '11' as never })
  let data
  try {
    data = (await w.recognize(canvas, {}, { blocks: true })).data
  } finally {
    await w.setParameters({ tessedit_pageseg_mode: '3' as never })
  }
  const out: OcrWord[] = []
  for (const block of data.blocks ?? [])
    for (const para of block.paragraphs)
      for (const line of para.lines)
        for (const word of line.words)
          out.push({ text: word.text, height: word.bbox.y1 - word.bbox.y0, line: line.text })
  return out
}
