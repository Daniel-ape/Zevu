import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version
import { viteSingleFile } from 'vite-plugin-singlefile'

// PREVIEW=1 builds one self-contained HTML file for the hosted preview.
export default defineConfig({
  plugins: process.env.PREVIEW ? [react(), viteSingleFile()] : [react()],
  // The CSS minifier drops the unprefixed backdrop-filter, which breaks the glass in Chrome.
  build: { cssMinify: false },
  // Relative paths so the app works from any folder (GitHub Pages, the native apps).
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
})
