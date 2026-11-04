import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { decodeCanvas, decodeCard } from '../data/barcode'

/**
 * Full-screen live camera that reads a barcode and closes.
 * If the camera can't be opened (no permission, not available), onFallback
 * is called so the caller can offer a photo instead.
 */
export function CameraScanner({ onCode, onClose, onFallback, card }: {
  /** format is set when scanning a loyalty card (card = true) */
  onCode: (code: string, format?: string) => void
  /** Read any card code (Code 128, QR…) instead of product barcodes. */
  card?: boolean
  onClose: () => void
  onFallback: () => void
}) {
  const { t } = useStore()
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [torch, setTorch] = useState<null | { on: boolean; set: (on: boolean) => void }>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let timer = 0
    const canvas = document.createElement('canvas')

    // Each frame tries one view in turn: the band behind the guide box, the
    // whole frame, and the band turned 90° (barcodes printed vertically).
    let n = 0
    const tick = async () => {
      const v = video.current
      if (stopped || !v || v.readyState < 2) { timer = window.setTimeout(tick, 200); return }
      const w = v.videoWidth, h = v.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const mode = n++ % 3
      if (mode === 0) {
        const cw = Math.min(w, 1000), ch = Math.round((cw / w) * h * 0.5)
        canvas.width = cw; canvas.height = ch
        ctx.drawImage(v, 0, h * 0.25, w, h * 0.5, 0, 0, cw, ch)
      } else if (mode === 1) {
        const scale = Math.min(1, 1000 / Math.max(w, h))
        canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale)
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      } else {
        // centre column of the frame, rotated so its bars become horizontal
        const sw = w * 0.5, sh = h
        const scale = Math.min(1, 1000 / sh)
        canvas.width = Math.round(sh * scale); canvas.height = Math.round(sw * scale)
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(v, w * 0.25, 0, sw, sh, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale)
        ctx.restore()
      }
      const hit = card
        ? await decodeCard(canvas).catch(() => null)
        : await decodeCanvas(canvas).then((c) => (c ? { text: c, format: 'EAN_13' } : null)).catch(() => null)
      if (stopped) return
      if (hit) {
        navigator.vibrate?.(40)
        if (card) onCode(hit.text, hit.format)
        else onCode(hit.text)
      } else timer = window.setTimeout(tick, 80)
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop())
        const v = video.current!
        v.srcObject = stream
        await v.play()
        setReady(true)
        // Keep focusing, and offer the light where the phone allows it.
        const track = stream.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] }
        if (caps.focusMode?.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
        }
        if (caps.torch) {
          const set = (on: boolean) => {
            track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {})
            setTorch({ on, set })
          }
          setTorch({ on: false, set })
        }
        tick()
      } catch {
        if (!stopped) onFallback()
      }
    })()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="camera" role="dialog" aria-label={t('scan.camera')}>
      <video ref={video} playsInline muted />
      <div className="camera-guide" />
      <div className="camera-hint">{ready ? t('scan.aim') : t('scan.starting')}</div>
      <div className="camera-actions">
        {torch && (
          <button className={'camera-close glass' + (torch.on ? ' on' : '')} onClick={() => torch.set(!torch.on)}>
            {t('scan.torch')}
          </button>
        )}
        <button className="camera-close glass" onClick={onClose}>{t('rc.close')}</button>
      </div>
    </div>
  )
}
