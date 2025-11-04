import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEV_HOST = 'dev-travelspending.tranquilcs.com'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // bind 0.0.0.0
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', DEV_HOST],
    hmr: {
      protocol: 'wss',
      host: DEV_HOST,    // public hostname
      clientPort: 443,   // browser connects over 443
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8009',  // Django via compose
        changeOrigin: true,
      },
    },
  },
})

