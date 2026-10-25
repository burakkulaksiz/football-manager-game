import { defineConfig } from 'vitest/config';

/** Denge raporu koşusu: `npm run balance` (bkz. src/tools/balance/run.balance.ts). Normal test koşusuna girmez. */
export default defineConfig({
  test: {
    environment: 'node',
    // İlerleme satırları koşu sırasında görünsün (varsayılan: test bitince toplu)
    disableConsoleIntercept: true,
    include: ['src/tools/balance/run.balance.ts'],
    testTimeout: 6 * 60 * 60 * 1000,
  },
});
