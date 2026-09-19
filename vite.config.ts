/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
