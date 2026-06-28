import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : '/WiggleSolve/',
  resolve: {
    alias: {
      '@demos':        resolve(__dirname, '../demos'),
      '@definitions':  resolve(__dirname, '../definitions'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
}))
