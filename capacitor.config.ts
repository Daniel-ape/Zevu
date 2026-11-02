import type { CapacitorConfig } from '@capacitor/cli'

// Native app wrapper (Android / iPhone). The web app in dist/ runs inside it;
// store pages open in the system's in-app browser (Custom Tabs / Safari View).
const config: CapacitorConfig = {
  appId: 'fi.hintaopas.app',
  appName: 'Hintaopas',
  webDir: 'dist',
}

export default config
