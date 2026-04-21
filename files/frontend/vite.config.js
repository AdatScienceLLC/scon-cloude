import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/shear_walls/' : '/',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8001',
      '/static': 'http://127.0.0.1:8001'
    }
  }
})
