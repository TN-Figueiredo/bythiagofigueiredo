// Config SÓ do spec Esc do diálogo "Remover canal" (T12B r3). Contra o next dev da 3997 (runbook), banco local, semente "T12B".
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './', testMatch: ['remover-canal-esc.spec.ts'], workers: 1, retries: 0, timeout: 120_000, reporter: [['list']],
  outputDir: process.env.T12B_OUT ?? 'test-results/t12b',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3997', viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' },
})
