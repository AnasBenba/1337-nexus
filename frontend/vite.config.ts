import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Production Vite configuration: compiles frontend SPA to /dist
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
