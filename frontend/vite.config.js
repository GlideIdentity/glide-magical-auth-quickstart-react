import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// All backend routes (Node, Go, or Java) run on this port.
const serverPort = process.env.VITE_BACKEND_PORT || '3001';
const serverTarget = `http://localhost:${serverPort}`;

/**
 * Vite plugin that serves the device binding completion page at /glide-complete.
 *
 * After carrier authentication, the aggregator redirects the phone browser to
 * /glide-complete with agg_code and session_key in the URL fragment. This page
 * extracts them and POSTs to /api/magical-auth/complete.
 *
 * We serve it from Vite middleware (not the backend) so it works regardless of
 * which backend server (Node, Go, Java) is running.
 */
function completionPagePlugin() {
  return {
    name: 'glide-completion-page',
    configureServer(server) {
      server.middlewares.use('/glide-complete', async (_req, res) => {
        try {
          const { getCompletionPageHtml } = await import('@glideidentity/glide-be-node-magical-auth');
          const html = getCompletionPageHtml('/api/magical-auth/complete');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'DENY');
          res.end(html);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/html');
          res.end('<h1>Failed to load completion page</h1><p>Ensure @glideidentity/glide-be-node-magical-auth is installed.</p>');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), completionPagePlugin()],
  root: path.resolve(__dirname),
  build: {
    outDir: '../dist',
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    proxy: {
      // All /api/* routes proxy to whichever backend is running (Node, Go, or Java)
      '/api': {
        target: serverTarget,
        changeOrigin: true,
      },
    },
  },
});
