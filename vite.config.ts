
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/helploop/',
  plugins: [react()],
  server: {
    allowedHosts: ['alphabetical-simpsons-federal-pill.trycloudflare.com'],
  },
})
