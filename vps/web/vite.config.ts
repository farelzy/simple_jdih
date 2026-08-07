import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    // Sourcemap tidak ikut: menambah beberapa MB yang harus diunduh pengunjung
    // dari VPS 1 GB tanpa CDN, dan tidak berguna bagi siapa pun kecuali kita.
    sourcemap: false
  },
  server: {
    port: 5173,
    // Saat pengembangan, /api diteruskan ke Express supaya tetap satu origin
    // dan tidak perlu mengurus CORS.
    proxy: { '/api': 'http://127.0.0.1:3101' }
  }
});
