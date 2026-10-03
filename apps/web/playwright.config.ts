import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.test for the Playwright process (global-setup/teardown/fixtures).
// Next.js dev server loads it automatically via NODE_ENV=test.
try {
  const lines = readFileSync(resolve(__dirname, '.env.test'), 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch {}

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']]
    : [['html', { open: 'on-failure' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3099',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testDir: './e2e/fixtures',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'no-db',
      testMatch: '**/tests/public/homepage.spec.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: ['**/tests/public/homepage.spec.ts', '**/tests/cms/observatorio/**'],
    },
    {
      // Observatório fidelity harness: every spec re-seeds the SAME localhost site from the mockup's oracle, so its
      // tests never run concurrently (one worker, serial). Specs that open a CMS screen use e2e/.auth/admin.json
      // (run with the 'setup' dependency); seed.spec and the self-test need no session (`--no-deps` is fine).
      name: 'observatorio',
      testMatch: '**/tests/cms/observatorio/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      teardown: 'observatorio-teardown',
      fullyParallel: false,
      workers: 1,
    },
    {
      // clears the oracle seed of the local site once the observatorio project ends (ensureSeeded keeps it between states)
      name: 'observatorio-teardown',
      testMatch: '**/tests/cms/observatorio/teardown.obs.ts',
    },
  ],
  globalSetup: './e2e/fixtures/global-setup.ts',
  globalTeardown: './e2e/fixtures/global-teardown.ts',
  webServer: {
    // Port 3099 avoids collisions with the normal dev server on 3001
    command: 'next dev -p 3099',
    url: 'http://localhost:3099',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      HAS_LOCAL_DB: '1',
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3099',
      PLAYWRIGHT_BASE_URL: 'http://localhost:3099',
      // Frozen observatório clock = the mockup's NOW_ISO (dados.js). observatoryNow() honours it only with OBS_E2E=1
      // outside production: `next dev` inlines NODE_ENV as 'development', so a NODE_ENV === 'test' gate would be dead.
      OBS_E2E: '1',
      OBS_NOW_OVERRIDE: '2026-10-24T15:02:00-03:00',
    },
  },
})
