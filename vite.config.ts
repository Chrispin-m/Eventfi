import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill these Node core modules
      include: ['buffer', 'stream', 'util', 'events'],
      // Enable global polyfills
      globals: {
        Buffer: true,
        global: true,
        process: true,
      }
    })
  ],

  // Alias Node-style globals to browser equivalents
  define: {
    'process.env': process.env,
    global: 'globalThis',
  },

  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  optimizeDeps: {
    include: ['buffer', 'process'],
    esbuildOptions: {
      // Map Node global to browser globalThis during pre-bundling
      define: {
        global: 'globalThis'
      }
    }
  }
})
