import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'attached_assets'),
      'connect-pg-simple': path.resolve(__dirname, 'stubs', 'connect-pg-simple.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
