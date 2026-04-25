import { test, expect } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { E2E_PASSWORDS } from '../../fixtures/global-setup'
import AxeBuilder from '@axe-core/playwright'

test.describe('Admin login', () => {
  test.use({ storageState: 'e2e/.auth/public.json' })
  test.describe.configure({ mode: 'serial' })

  test('login válido redireciona para /admin', async ({ page }) => {
    await page.goto('/admin/login')
    const login = new LoginPage(page)
    await login.login('e2e-admin@test.local', E2E_PASSWORDS.admin)
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('senha incorreta exibe erro e permanece em /admin/login', async ({ page }) => {
    await page.goto('/admin/login')
    const login = new LoginPage(page)
    await login.login('e2e-admin@test.local', 'wrong-password')
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(
      page.getByRole('alert').or(page.getByTestId('auth-error-message'))
    ).toBeVisible()
  })

  test('logout limpa sessão e redireciona para /admin/login', async ({ page }) => {
    // Login first
    await page.goto('/admin/login')
    await new LoginPage(page).login('e2e-admin@test.local', E2E_PASSWORDS.admin)
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })

    // Logout
    await page.goto('/admin/logout')
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 })

    // Trying to access /admin again redirects back
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('botão Google OAuth está visível', async ({ page }) => {
    await page.goto('/admin/login')
    // Google OAuth não é testado em E2E — fluxo externo não-determinístico.
    // Cobertura via unit test de /auth/callback route.
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /admin/login', async ({ page }) => {
      await page.goto('/admin/login')
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
