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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
