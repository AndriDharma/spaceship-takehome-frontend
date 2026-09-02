import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    // In development the app calls /api/... on its own origin and Vite
    // forwards it to the backend. That means no CORS in dev, and the same
    // relative URLs work in production once VITE_API_BASE points at the
    // deployed backend.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080/',
        changeOrigin: true,

        // Server-Sent Events break if the proxy buffers the response, which
        // it does by default for anything it thinks is a normal body.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache, no-transform'
          })
        },
      },
    },
  },
})
