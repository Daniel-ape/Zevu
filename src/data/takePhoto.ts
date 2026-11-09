import { Capacitor } from '@capacitor/core'

// In the iPhone/Android app the camera opens full screen through the Camera plugin
// (the web page's file picker shows it as a half sheet that jumps). On the web the
// hidden <input capture> is used as before.
export const nativeCamera = Capacitor.isNativePlatform()

const cancelled = (e: unknown) => /cancel|dismiss|no image picked|user denied/i.test(String((e as { message?: string })?.message ?? e))

async function fileFrom(path: string | undefined, format = 'jpeg') {
  if (!path) return null
  const blob = await (await fetch(path)).blob()
  return new File([blob], `photo.${format}`, { type: blob.type || 'image/jpeg' })
}

/**
 * A photo from the camera as a File; null if the user cancelled.
 * Throws if the native camera couldn't be used at all.
 */
export async function takePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  // The current API (plugin 8.1+), then the older one.
  try {
    const r = await Camera.takePhoto({ quality: 90, correctOrientation: true, saveToGallery: false, editable: 'no' })
    const path = r.webPath ?? (r.uri ? Capacitor.convertFileSrc(r.uri) : undefined)
    const f = await fileFrom(path)
    if (f) return f
    if (r.thumbnail) return fileFrom(`data:image/jpeg;base64,${r.thumbnail}`)
    return null
  } catch (e) {
    if (cancelled(e)) return null
  }
  try {
    const p = await Camera.getPhoto({
      source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 90,
      correctOrientation: true, saveToGallery: false, presentationStyle: 'fullscreen',
    })
    return fileFrom(p.webPath, p.format || 'jpeg')
  } catch (e) {
    if (cancelled(e)) return null
    throw e
  }
}

/** Open the camera: the native one in the app, otherwise (or if that fails) the page's file input. */
export function openCamera(input: HTMLInputElement | null, onFile: (f: File) => void, onError?: (msg: string) => void) {
  if (!nativeCamera) { input?.click(); return }
  takePhoto().then((f) => { if (f) onFile(f) }).catch((e) => {
    onError?.(String((e as { message?: string })?.message ?? e).slice(0, 140))
    input?.click()
  })
}
