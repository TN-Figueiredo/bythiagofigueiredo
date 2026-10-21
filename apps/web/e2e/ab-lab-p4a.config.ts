// Config do Playwright SÓ da suíte A/B Lab P4a (T17): specs em e2e/ab-lab-p4a-*.spec.ts, contra o `next dev` da porta 3097
// (subir-dev.sh) e o YouTube falso da 3098. Serial (um servidor falso, um estado), sem retry (instabilidade é achado).
// Os quatro projetos cruzam largura × fuso: 1440/390 × America/Sao_Paulo/Asia/Tokyo; o tema vem do projeto (ver TEMA_DO_PROJETO).
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

const PORTA = process.env.AB_P4A_PORTA ?? '3097'
const base = { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORTA}` }

export default defineConfig({
  testDir: './',
  testMatch: ['ab-lab-p4[ab]-*.spec.ts', 'fixtures/auth.setup.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: process.env.AB_P4A_JSON ?? 'test-results/ab-p4a.json' }]],
  outputDir: process.env.AB_P4A_OUT ?? 'test-results/ab-p4a',
  use: { actionTimeout: 15_000, navigationTimeout: 60_000, screenshot: 'off', trace: 'off', video: 'off' },
  globalSetup: './fixtures/global-setup.ts',
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...base, baseURL: `http://localhost:${PORTA}` } },
    { name: 'sp-1440', testMatch: /ab-lab-p4[ab]-.*\.spec\.ts/, dependencies: ['setup'], use: { ...base, viewport: { width: 1440, height: 900 }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' } },
    { name: 'sp-390', testMatch: /ab-lab-p4[ab]-.*\.spec\.ts/, dependencies: ['setup'], use: { ...base, viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR', isMobile: false, hasTouch: true } },
    { name: 'tokyo-1440', testMatch: /ab-lab-p4[ab]-.*\.spec\.ts/, dependencies: ['setup'], use: { ...base, viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Tokyo', locale: 'pt-BR' } },
    { name: 'tokyo-390', testMatch: /ab-lab-p4[ab]-.*\.spec\.ts/, dependencies: ['setup'], use: { ...base, viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', locale: 'pt-BR', hasTouch: true } },
  ],
})
