// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.BASE_URL || '/',
  build: {
    rollupOptions: {
      input: {
        appMain: resolve(__dirname, 'index.html'),
        appTest: resolve(__dirname, 'test.html'),
      },
    },
  },
})
