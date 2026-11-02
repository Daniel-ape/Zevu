// Barcode decoding for EAN-13 / EAN-8 / UPC. Uses the browser's built-in
// BarcodeDetector where it exists (Android Chrome), otherwise ZXing (bundled,
// loaded on first use). Everything runs on the device.

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

let native: Detector | null | undefined
async function nativeDetector(): Promise<Detector | null> {
  if (native !== undefined) return native
  native = null
  const BD = (globalThis as unknown as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector
  if (BD) {
    try {
      const formats = await BD.getSupportedFormats()
      if (formats.includes('ean_13')) native = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    } catch { /* not usable */ }
  }
  return native
}

type Zx = typeof import('@zxing/library')
let zx: Promise<{ lib: Zx; reader: InstanceType<Zx['MultiFormatReader']> }> | null = null
function zxing() {
  zx ??= import('@zxing/library').then((lib) => {
    const reader = new lib.MultiFormatReader()
    const hints = new Map()
    hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [
      lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.UPC_E,
    ])
    hints.set(lib.DecodeHintType.TRY_HARDER, true)
    reader.setHints(hints)
    return { lib, reader }
  })
  return zx
}

/** Check digit test, so a misread never opens the wrong product. */
export function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

const normalise = (code: string) => (code.length === 12 ? '0' + code : code) // UPC-A → EAN-13

export async function decodeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const det = await nativeDetector()
  if (det) {
    try {
      const hit = (await det.detect(canvas)).find((r) => isValidEan(r.rawValue))
      if (hit) return normalise(hit.rawValue)
    } catch { /* fall through to ZXing */ }
  }
  const { lib, reader } = await zxing()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const lum = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  const source = new lib.RGBLuminanceSource(lum, width, height)
  for (const bin of [new lib.HybridBinarizer(source), new lib.GlobalHistogramBinarizer(source)]) {
    try {
      const text = reader.decode(new lib.BinaryBitmap(bin)).getText()
      if (isValidEan(text)) return normalise(text)
    } catch { /* not found with this binarizer */ }
  }
  return null
}

/** Decode a still photo, trying a few sizes since phone photos are large. */
export async function decodeImage(file: Blob): Promise<string | null> {
  const img = await createImageBitmap(file)
  for (const max of [1400, 900, 2000]) {
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const code = await decodeCanvas(c)
    if (code) return code
  }
  return null
}
