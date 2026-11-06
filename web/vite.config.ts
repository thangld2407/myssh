import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const targetPort = process.env.VITE_API_PORT || process.env.PORT || '8080';
const targetUrl = process.env.VITE_API_TARGET || `http://localhost:${targetPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: targetUrl,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
