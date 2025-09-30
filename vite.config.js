import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      '7deb-89-138-138-216.ngrok-free.app',
      'fddbc5f72560.ngrok-free.app',
      '.ngrok-free.app', // This wildcard allows all ngrok-free.app subdomains
      'localhost'
    ],
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
}); 