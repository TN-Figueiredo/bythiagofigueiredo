import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['e2e/**', 'node_modules/**', '../../.claude/**', '**/.claude/**', '.claude/**'],
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
    // Coverage thresholds. v8 provider keeps runtime cheap (no Babel
    // instrumentation). Global thresholds prevent silent coverage drops;
    // LGPD module enforces stricter minimums (Sprint 5a Track E).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        perFile: false,
        'src/lib/lgpd/**': { lines: 90, functions: 90, branches: 85 },
        'src/components/lgpd/**': { lines: 90, functions: 90, branches: 85 },
      },
    },
  },
  resolve: {
    alias: [
      // Sprint 5b — `apps/web/lib/seo/` lives outside `src/`. Map specifically
      // so plan-prescribed `@/lib/seo/...` imports resolve correctly without
      // shadowing other `@/lib/*` paths under `src/lib/` (e.g. lgpd).
      { find: /^@\/lib\/seo(.*)$/, replacement: path.resolve(__dirname, './lib/seo$1') },
      // Sprint 5b PR-B Phase 2 — SEO module also imports cms repositories +
      // supabase service client which live outside `src/lib/`. Map them
      // explicitly so `@/lib/cms/...` / `@/lib/supabase/...` resolve correctly
      // (otherwise the catch-all `@` alias would point them at non-existent
      // `src/lib/...` paths).
      { find: /^@\/lib\/cms(.*)$/, replacement: path.resolve(__dirname, './lib/cms$1') },
      { find: /^@\/lib\/supabase(.*)$/, replacement: path.resolve(__dirname, './lib/supabase$1') },
      { find: /^@\/lib\/auth(.*)$/, replacement: path.resolve(__dirname, './lib/auth$1') },
      { find: /^@\/lib\/blog(.*)$/, replacement: path.resolve(__dirname, './lib/blog$1') },
      { find: /^@\/lib\/campaigns(.*)$/, replacement: path.resolve(__dirname, './lib/campaigns$1') },
      { find: /^@\/lib\/content-queue(.*)$/, replacement: path.resolve(__dirname, './lib/content-queue$1') },
      { find: /^@\/lib\/home(.*)$/, replacement: path.resolve(__dirname, './lib/home$1') },
      { find: /^@\/lib\/email(.*)$/, replacement: path.resolve(__dirname, './lib/email$1') },
      { find: /^@\/lib\/newsletter(.*)$/, replacement: path.resolve(__dirname, './lib/newsletter$1') },
      { find: /^@\/lib\/about(.*)$/, replacement: path.resolve(__dirname, './lib/about$1') },
      { find: /^@\/lib\/tracking(.*)$/, replacement: path.resolve(__dirname, './lib/tracking$1') },
      { find: /^@\/lib\/links(.*)$/, replacement: path.resolve(__dirname, './src/lib/links$1') },
      { find: /^@\/lib\/i18n(.*)$/, replacement: path.resolve(__dirname, './lib/i18n$1') },
      { find: /^@\/lib\/links(.*)$/, replacement: path.resolve(__dirname, './src/lib/links$1') },
      { find: /^@\/lib\/media(.*)$/, replacement: path.resolve(__dirname, './lib/media$1') },
      { find: /^@\/lib\/request(.*)$/, replacement: path.resolve(__dirname, './lib/request$1') },
      { find: /^@\/lib\/schedule(.*)$/, replacement: path.resolve(__dirname, './lib/schedule$1') },
      { find: /^@\/lib\/instagram(.*)$/, replacement: path.resolve(__dirname, './src/lib/instagram$1') },
      { find: /^@\/lib\/youtube(.*)$/, replacement: path.resolve(__dirname, './src/lib/youtube$1') },
      { find: /^@\/lib\/social(.*)$/, replacement: path.resolve(__dirname, './src/lib/social$1') },
      { find: /^@\/test(.*)$/, replacement: path.resolve(__dirname, './test$1') },
      // Explicit alias for Next.js dynamic-segment route so Vite resolves
      // the literal `[id]` directory (brackets confuse the catch-all regex).
      {
        find: '@/app/api/pipeline/audio-library/[id]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/audio-library/[id]/route.ts'),
      },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, './src/$1') },
    ],
  },
})
