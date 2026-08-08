import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const COLLECTOR_API = 'http://127.0.0.1:4317';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4318,
    // One origin in the browser, so there is no CORS and the API stays on loopback.
    proxy: { '/api': COLLECTOR_API },
  },
});
