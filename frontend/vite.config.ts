import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages user site: https://<user>.github.io/
// GitHub Pages repo site: https://<user>.github.io/<repo>/
// Custom domain via CNAME: '/' (root)
// Override via VITE_BASE_PATH at build time.
//
// Vite's default HTML transform only rewrites module <script src>,
// not arbitrary href / inline <script> references. This plugin fixes
// that, and injects window.__VITE_BASE__ for runtime use (e.g.
// service worker registration).
//
// NOTE: We only touch href / src, NEVER content (that's where metadata
// like viewport / theme-color / format-detection / og:* lives, and
// prefixing those breaks the page entirely).
function htmlBaseFix(base: string): Plugin {
  const isAbsolute = (p: string) =>
    /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(p) ||
    p.startsWith('data:') ||
    p.startsWith('blob:')

  return {
    name: 'html-base-fix',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!base || base === '/') {
          return html.replace(
            '<head>',
            `<head><script>window.__VITE_BASE__="/";</script>`,
          )
        }
        const b = base.endsWith('/') ? base : base + '/'
        const safeB = JSON.stringify(b)
        return html
          .replace(
            /((?:href|src))="([^"]*)"/g,
            (m, attr, path) => {
              if (!path || isAbsolute(path) || path.startsWith(b)) return m
              if (path.startsWith('/')) {
                return `${attr}="${b}${path.slice(1)}"`
              }
              return `${attr}="${b}${path}"`
            },
          )
          .replace(
            '<head>',
            `<head><script>window.__VITE_BASE__=${safeB};</script>`,
          )
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_PATH || '/bananacat/'
  return {
    base,
    plugins: [react(), htmlBaseFix(base)],
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
  }
})
