import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages user site: https://<user>.github.io/
// GitHub Pages repo site: https://<user>.github.io/<repo>/
// Custom domain via CNAME: '/' (root)
// Override via VITE_BASE_PATH at build time.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/bananacat/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
})
