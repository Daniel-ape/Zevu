# ZEVU

Compare More. Spend Less. (formerly Hintaopas)

Grocery price comparison for Finland (React + TypeScript, Vite). Runs as a web app
and as an Android/iPhone app through Capacitor.

## Develop

    npm install          # also prepares text recognition files (public/ocr)
    npm run dev          # web app at http://localhost:5173 with live Open Food Facts
    npm test             # receipt parser + Open Food Facts connector checks

Optional: bundle a snapshot of real Finnish products (needs access to openfoodfacts.org):

    python3 scripts/snapshot-images.py raw.json 1000   # raw.json = Open Food Facts search export
    npx tsx scripts/build-snapshot.ts raw.json

## Phone app (Android / iPhone)

Store leaflet pages open in the in-app browser (Custom Tabs on Android,
Safari View on iPhone); the camera opens directly for barcode and receipt scanning.

    npm run build && npx cap sync        # copy the web app into the native projects
    npx cap open android                 # opens Android Studio → Run ▶ on a phone
    npx cap open ios                     # macOS + Xcode only

Android needs Android Studio; iPhone needs a Mac with Xcode.

### iPhone without a Mac (Windows + Sideloadly)

GitHub builds an unsigned `Hintaopas.ipa` on every change and puts it on the
[`iphone` release](https://github.com/Daniel-ape/hintaopas/releases/tag/iphone).

1. On the Windows PC install **iTunes** and **iCloud** from apple.com (not the
   Microsoft Store versions), then **Sideloadly** from sideloadly.io.
2. Download `Hintaopas.ipa` from the release above.
3. Connect the iPhone with a cable, open Sideloadly, drag in the .ipa, type
   your Apple ID and press Start.
4. On the iPhone: Settings → General → VPN & Device Management → trust your
   Apple ID. Settings → Privacy & Security → Developer Mode → on (restarts).

With a free Apple ID the app works for 7 days; open Sideloadly and install
again to renew (the app's data stays).
