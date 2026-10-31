import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Kişisel, yerelde çalışan oyun: tek paket yeterli, boyut uyarısı gereksiz.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    // Motor testleri saf TS; tarayıcı ortamına gerek yok.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // İstatistik testleri binlerce maç oynatır, sezon testleri 8 yurtdışı ligini de oynatır; paralel koşarken uzun sürebilir.
    testTimeout: 120_000,
  },
});
