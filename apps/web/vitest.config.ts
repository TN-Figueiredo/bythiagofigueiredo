import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    environmentMatchGlobs: [
      ['src/app/api/**', 'node'],
      ['src/lib/**', 'node'],
    ],
    server: {
      deps: {
        // Inline @tn-figueiredo/cms + /auth-nextjs — both ship ESM that Node's
        // native resolver can't handle (missing .js extensions, import.meta.url).
        // Vite's bundler re-resolves them for the test run — matches the
        // transpilePackages behavior that Next uses at build time.
        inline: [
          /@tn-figueiredo\/admin/,
          /@tn-figueiredo\/auth-nextjs/,
          /@tn-figueiredo\/cms/,
          /@tn-figueiredo\/email/,
        ],
      },
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },
    // Sprint 5a Track E — LGPD module coverage thresholds. v8 provider keeps
    // runtime cheap (no Babel instrumentation). Only gates the LGPD surface so
    // legacy code isn't forced to 90% overnight. Run via `npx vitest run
    // --coverage` (CI or local).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/lgpd/**', 'src/components/lgpd/**'],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
