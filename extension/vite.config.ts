import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-content-css',
      writeBundle() {
        // Ensure dist directory exists
        const distDir = resolve(__dirname, 'dist');
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        // Copy manifest.json
        fs.copyFileSync(resolve(__dirname, 'manifest.json'), resolve(distDir, 'manifest.json'));
        // Copy content.css
        const cssPath = resolve(__dirname, 'src/content/content.css');
        if (fs.existsSync(cssPath)) {
          fs.copyFileSync(cssPath, resolve(distDir, 'content.css'));
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        whatsapp: resolve(__dirname, 'src/content/whatsapp.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'whatsapp') return 'content.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
