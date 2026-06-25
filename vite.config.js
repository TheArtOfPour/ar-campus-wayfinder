// Vite configuration
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: '.',
    assetsDir: 'assets',
    emptyOutDir: false
  },
  preview: {
    port: 5174,
    open: true
  }
});
