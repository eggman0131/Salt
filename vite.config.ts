
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite Configuration for SALT
// Environment variables prefixed with VITE_ are exposed to the client.
// Access via import.meta.env.VITE_GEMINI_API_KEY in browser code.
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    // Ensure service worker and manifest are included
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy Firebase Auth Emulator requests
      // Attempts to authenticate against the local emulator via the frontend dev server
      '/identitytoolkit.googleapis.com': {
        target: 'http://127.0.0.1:9099',
        changeOrigin: true,
      },
      '/securetoken.googleapis.com': {
        target: 'http://127.0.0.1:9099',
        changeOrigin: true,
      },
      '/emulator/auth': {
        target: 'http://127.0.0.1:9099',
        changeOrigin: true,
      },
      // Proxy Firebase Firestore Emulator requests
      '/google.firestore.v1.Firestore': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        ws: true // Enable WebSocket proxying for Firestore
      },
      // Proxy Firebase Storage Emulator requests
      '/v0': {
        target: 'http://127.0.0.1:9199',
        changeOrigin: true,
      },
      // Proxy Firebase Functions Emulator requests
      // This matches the project ID found in backend/firebase.ts
      '/gen-lang-client-0015061880': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      }
    }
  }
});
