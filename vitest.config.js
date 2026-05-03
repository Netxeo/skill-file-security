import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.skills/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['install.js'],
      // ─── HARD GATE ────────────────────────────────────────────────────────
      // These thresholds are a non-negotiable quality floor.
      // Any PR or agent that drops coverage below these values will cause
      // `npm run test:coverage` to exit with a non-zero code, blocking CI.
      // DO NOT lower these values. Raise them as coverage improves.
      // autoUpdate: false ensures the runner never silently mutates them.
      // ──────────────────────────────────────────────────────────────────────
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        autoUpdate: false,
      },
    },
  },
})
