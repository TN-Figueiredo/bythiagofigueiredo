import fs from 'node:fs'
import path from 'node:path'
import { test as setup, expect } from '@playwright/test'
import dotenv from 'dotenv'
import { E2E_PASSWORDS } from './global-setup'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

const AUTH_DIR = path.resolve(__dirname, '../.auth')
fs.mkdirSync(AUTH_DIR, { recursive: true })

async function loginAs(page: import('@playwright/test').Page, area: 'admin' | 'cms', email: string, password: string): Promise<void> {
  await page.goto(`/${area}/login`)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  const responsePromise = page.waitForResponse(resp =>
    (resp.url().includes('/auth') || resp.url().includes('/login')) && resp.request().method() === 'POST'
  )
  await page.locator('button[type="submit"]').click()
  await responsePromise
  await expect(page).toHaveURL(new RegExp(`\\/${area}`), { timeout: 15_000 })
}

setup('authenticate as admin', async ({ page }) => {
  await loginAs(page, 'admin', 'e2e-admin@test.local', E2E_PASSWORDS.admin)
  await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') })
})

setup('authenticate as editor', async ({ page }) => {
  await loginAs(page, 'cms', 'e2e-editor@test.local', E2E_PASSWORDS.editor)
  await page.context().storageState({ path: path.join(AUTH_DIR, 'editor.json') })
})

setup('authenticate as reporter', async ({ page }) => {
  await loginAs(page, 'cms', 'e2e-reporter@test.local', E2E_PASSWORDS.reporter)
  await page.context().storageState({ path: path.join(AUTH_DIR, 'reporter.json') })
})

setup('save public state', async ({ page }) => {
  await page.goto('/')
  await page.context().storageState({ path: path.join(AUTH_DIR, 'public.json') })
})
