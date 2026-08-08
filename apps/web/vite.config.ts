import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const COLLECTOR_API = 'http://127.0.0.1:4317';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4318,
    // Proxying keeps the browser on one origin, so there is no CORS to configure and
    // the API stays bound to loopback.
    proxy: { '/api': COLLECTOR_API },
  },
});
