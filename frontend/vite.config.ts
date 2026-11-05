import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_TARGET ?? 'http://localhost:5099';   // where the backend listens

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, proxy: { '/api': api } },
  preview: { host: true, port: 4173, proxy: { '/api': api } },
});
