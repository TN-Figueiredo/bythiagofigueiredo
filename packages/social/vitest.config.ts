import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // No passWithNoTests: the suite now has real coverage (core + providers),
    // so an empty run must fail loudly rather than pass silently.
  },
})
