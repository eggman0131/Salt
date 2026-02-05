
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite Configuration for SALT
// Environment variables prefixed with VITE_ are exposed to the client.
// Access via import.meta.env.VITE_GEMINI_API_KEY in browser code.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});
