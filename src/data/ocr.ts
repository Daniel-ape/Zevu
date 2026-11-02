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

/** Downscale and convert to high-contrast greyscale; receipts read much better. */
async function prepare(file: File, boost = true): Promise<HTMLCanvasElement> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 2200 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, c.width, c.height)
  if (!boost) return c
  const d = ctx.getImageData(0, 0, c.width, c.height)
  for (let i = 0; i < d.data.length; i += 4) {
    const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]
    const v = Math.max(0, Math.min(255, (g - 128) * 1.5 + 128))
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v
  }
  ctx.putImageData(d, 0, 0)
  return c
}

export async function photoToText(file: File, onProgress: (p: number) => void = () => {}): Promise<string> {
  const [w, canvas] = await Promise.all([getWorker(onProgress), prepare(file)])
  const { data } = await w.recognize(canvas)
  return data.text
}

export interface OcrWord { text: string; height: number; line: string }

/** Words with their size, so the big price on a shelf label can be told apart from small print. */
export async function photoToWords(file: File, onProgress: (p: number) => void = () => {}): Promise<OcrWord[]> {
  // Labels are photographed in colour and good light: skip the receipt contrast boost.
  const w = await getWorker(onProgress)
  const canvas = await prepare(file, false)
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
