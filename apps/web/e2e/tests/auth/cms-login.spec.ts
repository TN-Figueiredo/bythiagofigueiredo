import { test, expect } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { E2E_PASSWORDS } from '../../fixtures/global-setup'
import AxeBuilder from '@axe-core/playwright'

test.describe('CMS login', () => {
  test.use({ storageState: 'e2e/.auth/public.json' })
  test.describe.configure({ mode: 'serial' })

  test('login válido redireciona para /cms', async ({ page }) => {
    await page.goto('/cms/login')
    await new LoginPage(page).login('e2e-editor@test.local', E2E_PASSWORDS.editor)
    await expect(page).toHaveURL(/\/cms/, { timeout: 15_000 })
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('senha incorreta exibe erro e permanece em /cms/login', async ({ page }) => {
    await page.goto('/cms/login')
    await new LoginPage(page).login('e2e-editor@test.local', 'wrong-password')
    await expect(page).toHaveURL(/\/cms\/login/)
    await expect(
      page.getByRole('alert').or(page.getByTestId('auth-error-message'))
    ).toBeVisible()
  })

  test('redirect pós-login com ?next= preserva destino', async ({ page }) => {
    // Access protected page without auth → should redirect to login with ?next=
    await page.goto('/cms/blog')
    await expect(page).toHaveURL(/\/cms\/login/, { timeout: 10_000 })
    const url = new URL(page.url())
    const next = url.searchParams.get('next') || '/cms/blog'

    // Login
    await new LoginPage(page).login('e2e-editor@test.local', E2E_PASSWORDS.editor)

    await expect(page).toHaveURL(url => url.includes(next), { timeout: 15_000 })
  })

  test('logout limpa sessão e redireciona para /cms/login', async ({ page }) => {
    await page.goto('/cms/login')
    await new LoginPage(page).login('e2e-editor@test.local', E2E_PASSWORDS.editor)
    await expect(page).toHaveURL(/\/cms/, { timeout: 15_000 })

    await page.goto('/cms/logout')
    await expect(page).toHaveURL(/\/cms\/login/, { timeout: 10_000 })

    await page.goto('/cms')
    await expect(page).toHaveURL(/\/cms\/login/)
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /cms/login', async ({ page }) => {
      await page.goto('/cms/login')
      const results = await new AxeBuilder({ page }).analyze()
      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(
        critical,
        critical.map(v => `${v.id}: ${v.description}`).join('\n')
      ).toHaveLength(0)
    })
  })
})
