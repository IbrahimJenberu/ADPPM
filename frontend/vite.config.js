import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path' // ⬅️ Add this

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // ⬅️ Add this
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
