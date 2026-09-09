import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'craft-ts-app',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
});
