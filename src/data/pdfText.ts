// Extracts text lines from a PDF receipt in the browser. pdf.js and its
// worker are bundled (no CDN), and loaded only when a PDF is imported.

export async function pdfToText(file: File): Promise<string> {
  const [pdfjs, workerSrc] = await Promise.all([
    import('pdfjs-dist/build/pdf.min.js'),
    import('pdfjs-dist/build/pdf.worker.min.js?raw'),
  ])
  const lib = (pdfjs as unknown as { default?: typeof pdfjs }).default ?? pdfjs
  const workerUrl = URL.createObjectURL(new Blob([workerSrc.default], { type: 'text/javascript' }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = lib as any
  L.GlobalWorkerOptions.workerPort = new Worker(workerUrl)

  const doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const lines: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    // Group text pieces into lines by their vertical position.
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!it.str.trim()) continue
      const y = Math.round(it.transform[5] / 3) * 3
      const row = rows.get(y) ?? []
      row.push({ x: it.transform[4], s: it.str })
      rows.set(y, row)
    }
    ;[...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, row]) => lines.push(row.sort((a, b) => a.x - b.x).map((r) => r.s).join(' ')))
  }
  return lines.join('\n')
}
