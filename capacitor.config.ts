import type { CapacitorConfig } from '@capacitor/cli'

// Native app wrapper (Android / iPhone). The web app in dist/ runs inside it;
// store pages open in the system's in-app browser (Custom Tabs / Safari View).
// The background runner checks watched prices every few hours
// (public/runners/background.js) and sends a notification when one drops.
const config: CapacitorConfig = {
  appId: 'fi.hintaopas.app',
  appName: 'ZEVU',
  webDir: 'dist',
  plugins: {
    BackgroundRunner: {
      label: 'fi.hintaopas.app.pricecheck',
      src: 'runners/background.js',
      event: 'checkPrices',
      repeat: true,
      interval: 180,
      autoStart: true,
    },
  },
}

export default config
