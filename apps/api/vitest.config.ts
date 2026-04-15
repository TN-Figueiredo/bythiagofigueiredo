import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: process.env.HAS_LOCAL_DB ? false : true,
  },
})
