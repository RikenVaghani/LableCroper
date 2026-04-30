import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pdf': ['pdf-lib', 'pdfjs-dist'],
          'vendor-utils': ['jszip', 'lucide-react', 'framer-motion']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
