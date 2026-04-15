import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

// In the monorepo, react/react-dom are hoisted to the root node_modules.
// We alias to that copy so tests dedupe with the web app's React 19 and
// avoid duplicate-React hook dispatcher errors.
// When this package is extracted to its own repo (Sprint 2 T14), the root
// doesn't exist — fall back to standard resolution via the package's own
// node_modules.
const monorepoReact = fileURLToPath(new URL('../../node_modules/react', import.meta.url))
const monorepoReactDom = fileURLToPath(new URL('../../node_modules/react-dom', import.meta.url))
const isMonorepo = existsSync(monorepoReact) && existsSync(monorepoReactDom)

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    ...(isMonorepo
      ? {
          alias: {
            react: monorepoReact,
            'react-dom': monorepoReactDom,
          },
        }
      : {}),
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
