import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

/**
 * Vite plugin that resolves `@/` aliases for files loaded from directories
 * whose names contain brackets (e.g. `[id]`, `[section]`). The default
 * regex-based alias engine fails to match `@/…` imports originating from
 * such directories because Node/Vite treats the brackets as special chars.
 * This plugin intercepts any unresolved `@/…` import and maps it to the
 * `src/` tree with standard TypeScript extension probing.
 */
function bracketDirAliasPlugin(): Plugin {
  const srcRoot = path.resolve(__dirname, 'src')
  // Also probe the non-src root for lib/ paths resolved by tsconfig
  const appRoot = path.resolve(__dirname)
  return {
    name: 'bracket-dir-alias',
    enforce: 'pre',
    resolveId(source, _importer) {
      if (!source.startsWith('@/')) return null
      const needsHelp = source.includes('(') || source.includes('[')
      if (!needsHelp) return null
      const relative = source.slice(2) // strip `@/`
      for (const root of [srcRoot, appRoot]) {
        for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
          const candidate = path.join(root, relative + ext)
          if (fs.existsSync(candidate)) {
            return candidate
          }
        }
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [react(), bracketDirAliasPlugin()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
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
          /@tn-figueiredo\/links-admin/,
          /@tn-figueiredo\/newsletter/,
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
        'src/lib/youtube/**': { lines: 75, functions: 75, branches: 65 },
      },
    },
  },
  resolve: {
    alias: [
      // Stub `server-only` — the package isn't installed but Next.js provides
      // it at build time. Tests that import source files with `import 'server-only'`
      // need this resolved to an empty module.
      { find: /^server-only$/, replacement: path.resolve(__dirname, './test/__stubs__/server-only.ts') },
      // Stub `next/cache` — server-only Next.js cache APIs (unstable_cache, etc.)
      // aren't available in the Vitest runtime. Pass-through stub keeps test
      // imports working without Next infrastructure.
      { find: /^next\/cache$/, replacement: path.resolve(__dirname, './test/__stubs__/next-cache.ts') },
      // @tn-figueiredo/email requires `resend` as a peer dep. It's not installed
      // directly — stub it so inlined email package resolves without errors.
      { find: /^resend$/, replacement: path.resolve(__dirname, './test/__stubs__/resend.ts') },
      // `nodemailer` is the OTHER optional peer dep of @tn-figueiredo/email (SMTP
      // transport). Not installed (project sends via Resend/SES), but the inlined
      // email package's SMTP chunk references it — stub so it resolves in tests.
      { find: /^nodemailer$/, replacement: path.resolve(__dirname, './test/__stubs__/nodemailer.ts') },
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
      { find: /^@\/lib\/lgpd(.*)$/, replacement: path.resolve(__dirname, './src/lib/lgpd$1') },
      { find: /^@\/lib\/instagram(.*)$/, replacement: path.resolve(__dirname, './src/lib/instagram$1') },
      { find: /^@\/lib\/youtube(.*)$/, replacement: path.resolve(__dirname, './src/lib/youtube$1') },
      { find: /^@\/lib\/social(.*)$/, replacement: path.resolve(__dirname, './src/lib/social$1') },
      { find: /^@\/lib\/pipeline(.*)$/, replacement: path.resolve(__dirname, './src/lib/pipeline$1') },
      { find: /^@\/lib\/playlists(.*)$/, replacement: path.resolve(__dirname, './src/lib/playlists$1') },
      { find: /^@\/test(.*)$/, replacement: path.resolve(__dirname, './test$1') },
      // Explicit aliases for Next.js dynamic-segment routes: brackets in
      // directory names (`[id]`, `[section]`, etc.) confuse the catch-all `@/`
      // regex, so each bracketed path gets its own string-based alias that
      // Vite resolves literally (no regex expansion of the `[` / `]` chars).
      {
        find: '@/app/api/pipeline/audio-library/[id]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/audio-library/[id]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/broll-library/[id]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/broll-library/[id]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/docs/[domain]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/docs/[domain]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/advance/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/advance/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/retreat/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/retreat/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/checklist/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/checklist/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/restore/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/restore/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/link/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/link/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/unlink/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/unlink/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/graduate/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/graduate/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/history/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/history/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/publish/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/publish/route.ts'),
      },
      {
        find: '@/app/api/pipeline/items/[id]/sections/[section]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/items/[id]/sections/[section]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/youtube/ab-tests/[id]/variants/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts'),
      },
      {
        find: '@/app/api/pipeline/research/[id]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/research/[id]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/research/[id]/links/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/research/[id]/links/route.ts'),
      },
      {
        find: '@/app/api/pipeline/research/[id]/links/[linkId]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/research/[id]/links/[linkId]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/research/topics/[id]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/research/topics/[id]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/topics/[code]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/topics/[code]/route.ts'),
      },
      {
        find: '@/app/api/pipeline/context/[key]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/context/[key]/route.ts'),
      },
      {
        find: '@/app/cms/(authed)/links/[id]/qr/card-actions',
        replacement: path.resolve(__dirname, './src/app/cms/(authed)/links/[id]/qr/card-actions.ts'),
      },
      {
        find: '@/app/cms/(authed)/links/[id]/_components/qr-cards-strip',
        replacement: path.resolve(__dirname, './src/app/cms/(authed)/links/[id]/_components/qr-cards-strip.tsx'),
      },
      // Blog editor — bracket directory `[id]` breaks regex-based alias.
      // String-based find uses startsWith matching which handles brackets reliably.
      {
        find: '@/app/cms/(authed)/blog/[id]/edit/',
        replacement: path.resolve(__dirname, './src/app/cms/(authed)/blog/[id]/edit/'),
      },
      {
        find: /^@\/app\/cms\/\(authed\)(.*)$/,
        replacement: `${path.resolve(__dirname, './src/app/cms/(authed)')}$1`,
      },
      {
        find: /^@\/app\/admin\/\(authed\)(.*)$/,
        replacement: `${path.resolve(__dirname, './src/app/admin/(authed)')}$1`,
      },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, './src/$1') },
    ],
  },
})
