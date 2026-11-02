# Hintaopas

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
