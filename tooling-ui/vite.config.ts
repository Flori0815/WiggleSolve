import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : '/WiggleSolve/',
  resolve: {
    alias: {
      // Consume the core as source so edits hot-reload without a separate build.
      '@wigglesolve/core': resolve(__dirname, '../core-js/src/index.ts'),
      '@demos':            resolve(__dirname, '../demos'),
      '@definitions':      resolve(__dirname, '../definitions'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
}))
