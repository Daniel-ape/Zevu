import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

// Native Liquid Glass tab bar on iPhone (ios/App/App/NativeDock.swift).
export interface DockTab { id: string; label: string; icon: string }
interface NativeDockPlugin {
  show(opts: { tabs: DockTab[]; selected: string; badges: string[]; scanLabel: string }): Promise<void>
  hide(): Promise<void>
  addListener(event: 'tap', cb: (e: { id: string }) => void): Promise<PluginListenerHandle>
}

export const NativeDock = registerPlugin<NativeDockPlugin>('NativeDock')

/** True inside the iPhone app, where the native dock replaces the web one. */
export const wantsNativeDock = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform()

/** SF Symbols for each tab. */
export const DOCK_ICONS: Record<string, string> = {
  home: 'house.fill',
  search: 'bag',
  lists: 'list.bullet.rectangle',
  leaflets: 'newspaper',
  profile: 'person.crop.circle',
}
