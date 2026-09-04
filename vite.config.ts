import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Allows imports like '@/features/auth/useAuth'
      // instead of '../../features/auth/useAuth'
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Vitest config lives here — no separate vitest.config.ts needed
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  server: {
    proxy: {
      '/api/locationiq': {
        target: 'https://us1.locationiq.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/locationiq/, ''),
      },
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'WanderBoard/0.1.0 (contact: your-email@example.com)');
          });
        },
      }
    }
  }
});
