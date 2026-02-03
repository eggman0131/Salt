
import { defineConfig } from 'vite';

// Fixed error: Property 'cwd' does not exist on type 'Process'.
// Adhered to Google GenAI guidelines: "Do not define process.env".
// The API_KEY is automatically injected into process.env.API_KEY by the execution context.
export default defineConfig({
  server: {
    port: 3000,
    open: true
  }
});
