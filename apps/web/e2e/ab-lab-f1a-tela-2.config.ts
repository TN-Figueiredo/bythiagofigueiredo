// Config do Playwright SÓ da suíte do Gio para a F1a-tela-2 (T9): specs em e2e/ab-lab-f1a-tela-2-*.spec.ts (login e semente-base da tela-1) contra o `next dev` da
// porta 3094 no host f1a.localhost (subir-dev.sh), YouTube falso na 3095 e Blob falso na 3096. Serial, sem retry (instabilidade é achado).
// Quatro projetos: 1440/390 × escuro/claro. O tema vem do projeto (cookie btf_theme), a largura do viewport.
import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

try {
  for (const line of readFileSync(resolve(__dirname, '../.env.test'), 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    if (k && !(k in process.env)) process.env[k] = t.slice(eq + 1).trim()
  }
} catch { /* sem .env.test */ }

const PORTA = process.env.F1A_PORTA ?? '3094'
const base = { ...devices['Desktop Chrome'], baseURL: `http://f1a.localhost:${PORTA}`, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' }
const spec = /ab-lab-f1a-tela-2-.*\.spec\.ts/

export default defineConfig({
  testDir: './',
  testMatch: ['ab-lab-f1a-tela-2-*.spec.ts', 'ab-lab-f1a-tela-1-suporte/auth-f1a.setup.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: process.env.F1A_JSON ?? 'test-results/f1a-tela-2.json' }]],
  outputDir: process.env.F1A_OUT ?? 'test-results/f1a-tela-2',
  use: { actionTimeout: 15_000, navigationTimeout: 60_000, screenshot: 'off', trace: 'off', video: 'off' },
  globalSetup: './fixtures/global-setup.ts',
  projects: [
    { name: 'setup', testMatch: /auth-f1a\.setup\.ts/, use: { ...base } },
    { name: 'l1440-dark', testMatch: spec, dependencies: ['setup'], use: { ...base, viewport: { width: 1440, height: 900 } } },
    { name: 'l1440-light', testMatch: spec, dependencies: ['setup'], use: { ...base, viewport: { width: 1440, height: 900 } } },
    { name: 'l390-dark', testMatch: spec, dependencies: ['setup'], use: { ...base, viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'l390-light', testMatch: spec, dependencies: ['setup'], use: { ...base, viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
})
