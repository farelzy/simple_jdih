import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  server: {
    port: 5174,
    // Saat pengembangan, jalankan `vercel dev` di port 3000 supaya /api/data
    // dilayani fungsi yang sama seperti di produksi.
    proxy: { '/api': 'http://127.0.0.1:3000' }
  }
});
