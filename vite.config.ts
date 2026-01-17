import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'

// https://vite.dev/config/
export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version)
  },
  base: '/Yusic-UI/',
  plugins: [
    vue(),
    vueDevTools(),
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => {
          // If it is /api/rooms..., strip /api
          if (path.startsWith('/api/rooms')) {
            return path.replace(/^\/api/, '')
          }
          // Otherwise keep /api (which backend proxies to music-dl)
          return path
        },
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            if (proxyRes.headers['location']) {
              proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^http:\/\//, 'https://')
            }
          })
        }
      }
    }
  }
})
