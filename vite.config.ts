import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Motor testleri saf TS; tarayıcı ortamına gerek yok.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
