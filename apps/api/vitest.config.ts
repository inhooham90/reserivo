import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    // Disables rate limiting; the suite makes far more credential calls than a human could.
    env: { NODE_ENV: 'test' },
    root: './',
    include: ['**/*.spec.ts'],
  },
});
