import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }

          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase'
          }

          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }

          return undefined
        },
      },
    },
  },
})
