import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  build: {
    outDir: '../dist',
  },
  server: {
    host: true,
    port: 3000,
    // Allow all hosts so tunnels (ngrok, cloudflared) and deployed previews work
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/glide-complete': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
