import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  envDir: '../../',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/react-router-dom/') || id.includes('/react-router/')) {
            return 'vendor-router'
          }

          if (id.includes('/@tanstack/')) {
            return 'vendor-query'
          }

          if (id.includes('/framer-motion/')) {
            return 'vendor-motion'
          }

          if (id.includes('/react-icons/')) {
            return 'vendor-icons'
          }

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor-react'
          }

          if (id.includes('/axios/') || id.includes('/zod/')) {
            return 'vendor-data'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
})
