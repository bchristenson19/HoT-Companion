// ── HoT Companion — electron-vite build config ──────────────────────────────
// Three targets: main (Node), preload (Node), renderer (browser/React).
// The main process reads/writes gzipped .companionconfig files with Node's
// built-in zlib — no native addons to externalize.

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    base: './',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: resolve('src/renderer/index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/main'),
        '@resources': resolve('resources'),
      },
    },
  },
})
