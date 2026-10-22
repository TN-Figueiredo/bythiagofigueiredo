// Login do admin semeado NO HOST DA SUÍTE (f1a.localhost): o cookie de sessão é por host, o storageState de `localhost` não vale aqui.
import fs from 'node:fs'
import path from 'node:path'
import { test as setup, expect } from '@playwright/test'
import dotenv from 'dotenv'
import { E2E_PASSWORDS } from '../fixtures/global-setup'
import { semear } from './semente'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })
export const AUTH_F1A = path.resolve(__dirname, '../.auth/f1a-admin.json')
fs.mkdirSync(path.dirname(AUTH_F1A), { recursive: true })

setup('login do admin em f1a.localhost', async ({ page }) => {
  await semear() // o middleware só resolve o host se o site existir
  await page.goto('/admin/login')
  await page.locator('input[type="email"]').fill('e2e-admin@test.local')
  await page.locator('input[type="password"]').fill(E2E_PASSWORDS.admin)
  await page.waitForFunction(() => !!document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value, null, { timeout: 30_000 })
  const resposta = page.waitForResponse((r) => (r.url().includes('/auth') || r.url().includes('/login')) && r.request().method() === 'POST')
  await page.locator('button[type="submit"]').click()
  await resposta
  await expect(page, 'login terminou fora da tela de login').not.toHaveURL(/\/login(\?|$|\/)/, { timeout: 20_000 })
  await expect.poll(async () => (await page.context().cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name)).length, { timeout: 15_000 }).toBeGreaterThan(0)
  await page.context().storageState({ path: AUTH_F1A })
})
