// Vite configuration
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  preview: {
    port: 5174,
    open: true
  }
});
