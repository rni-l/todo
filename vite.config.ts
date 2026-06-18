import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: 'src/client/main.tsx',
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: assetInfo => assetInfo.name?.endsWith('.css')
          ? 'assets/app.css'
          : 'assets/[name][extname]'
      }
    }
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:38887',
      '/prototype': 'http://127.0.0.1:38887'
    }
  }
});
