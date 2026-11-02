import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { decodeCanvas } from '../data/barcode'

/**
 * Full-screen live camera that reads a barcode and closes.
 * If the camera can't be opened (no permission, not available), onFallback
 * is called so the caller can offer a photo instead.
 */
export function CameraScanner({ onCode, onClose, onFallback }: {
  onCode: (code: string) => void
  onClose: () => void
  onFallback: () => void
}) {
  const { t } = useStore()
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let timer = 0
    const canvas = document.createElement('canvas')

    const tick = async () => {
      const v = video.current
      if (stopped || !v || v.readyState < 2) { timer = window.setTimeout(tick, 200); return }
      // Read the centre band of the frame, where the guide box is.
      const w = v.videoWidth, h = v.videoHeight
      const cw = Math.min(w, 1000), ch = Math.round((cw / w) * h * 0.5)
      canvas.width = cw
      canvas.height = ch
      canvas.getContext('2d', { willReadFrequently: true })!.drawImage(v, 0, h * 0.25, w, h * 0.5, 0, 0, cw, ch)
      const code = await decodeCanvas(canvas).catch(() => null)
      if (stopped) return
      if (code) {
        navigator.vibrate?.(40)
        onCode(code)
      } else timer = window.setTimeout(tick, 150)
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
      <button className="camera-close glass" onClick={onClose}>{t('rc.close')}</button>
    </div>
  )
}
