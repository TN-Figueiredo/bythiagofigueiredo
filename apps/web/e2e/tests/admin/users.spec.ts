import { test, expect } from '../../fixtures'
import { AdminShellPage } from '../../pages/AdminShellPage'
import AxeBuilder from '@axe-core/playwright'

test.describe('Admin / Usuários', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin.from('invitations').delete().like('email', 'e2e-%@test.example')
  })

  test('lista de usuários carrega', async ({ page }) => {
    await page.goto('/admin/users')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText(/[Rr]ole|[Pp]apel/i)).toBeVisible()
    await expect(page.getByText(/[Ee]mail/i)).toBeVisible()
  })

  test('convidar usuário site-scoped (editor)', async ({ page, testId }) => {
    const email = `e2e-invite-editor-${testId}@test.example`
    await page.goto('/admin/users')

    await new AdminShellPage(page).inviteUser(email, 'editor')
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 })
  })

  test('convidar usuário site-scoped (reporter)', async ({ page, testId }) => {
    const email = `e2e-invite-reporter-${testId}@test.example`
    await page.goto('/admin/users')

    await new AdminShellPage(page).inviteUser(email, 'reporter')
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 })
  })

  test('revogar convite remove da lista', async ({ page, supabaseAdmin, siteId, testId }) => {
    const email = `e2e-invite-revoke-${testId}@test.example`
    // Seed invitation directly
    await supabaseAdmin.from('invitations').insert({
      email,
      site_id: siteId,
      role_scope: 'site',
      role: 'editor',
      token_hash: `revoke-token-hash-${testId}`,
    })

    await page.goto('/admin/users')
    await expect(page.getByText(email)).toBeVisible()
    await new AdminShellPage(page).revokeInvite(email)
    await expect(page.getByText(email)).not.toBeVisible({ timeout: 10_000 })
  })

  test('super_admin vê dropdown de contexto com orgs', async ({ page }) => {
    await page.goto('/admin/users')
    // Super admin should see an org/site context selector
    await expect(
      page.getByRole('combobox').or(page.getByLabel(/[Oo]rg|[Ss]ite/))
    ).toBeVisible()
  })

  test('editar role de usuário atualiza tabela', async ({ page }) => {
    await page.goto('/admin/users')
    const editButton = page.getByRole('button', { name: /[Ee]ditar|[Ee]dit/i }).first()
    await expect(editButton).toBeVisible({ timeout: 10_000 })
    await editButton.click()

    const roleSelect = page.getByLabel(/[Pp]apel|[Rr]ole/i)
    await expect(roleSelect).toBeVisible()
    const currentRole = await roleSelect.inputValue()
    const newRole = currentRole === 'editor' ? 'reporter' : 'editor'
    await roleSelect.selectOption(newRole)
    await page.getByRole('button', { name: /[Ss]alvar|[Ss]ave/i }).click()

    await page.reload()
    await expect(page.getByText(new RegExp(newRole, 'i')).first()).toBeVisible()

    // Restore original role
    const restoreEditBtn = page.getByRole('button', { name: /[Ee]ditar|[Ee]dit/i }).first()
    await expect(restoreEditBtn).toBeVisible()
    await restoreEditBtn.click()
    await page.getByLabel(/[Pp]apel|[Rr]ole/i).selectOption(currentRole)
    await page.getByRole('button', { name: /[Ss]alvar|[Ss]ave/i }).click()
  })

  test.describe('reporter — acesso negado a /admin', () => {
    test.use({ storageState: 'e2e/.auth/reporter.json' })

    test('reporter redirecionado ao tentar acessar /admin', async ({ page }) => {
      await page.goto('/admin')
      await expect(page).toHaveURL(/\/cms\/login/, { timeout: 10_000 })
    })
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /admin', async ({ page }) => {
      await page.goto('/admin')
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
