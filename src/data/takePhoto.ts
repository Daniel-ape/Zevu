import { Capacitor } from '@capacitor/core'

// In the iPhone/Android app the camera opens full screen through the Camera plugin
// (the web page's file picker shows it as a half sheet that jumps). On the web the
// hidden <input capture> is used as before.
export const nativeCamera = Capacitor.isNativePlatform()

/** A photo from the camera as a File, or null if cancelled. */
export async function takePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  try {
    const p = await Camera.getPhoto({
      source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 90,
      correctOrientation: true, saveToGallery: false, presentationStyle: 'fullscreen',
    })
    if (!p.webPath) return null
    const blob = await (await fetch(p.webPath)).blob()
    return new File([blob], `photo.${p.format || 'jpeg'}`, { type: blob.type || 'image/jpeg' })
  } catch {
    return null // cancelled, or no permission
  }
}

/** Open the camera: the native one in the app, otherwise the page's file input. */
export function openCamera(input: HTMLInputElement | null, onFile: (f: File) => void) {
  if (nativeCamera) takePhoto().then((f) => { if (f) onFile(f) })
  else input?.click()
}
