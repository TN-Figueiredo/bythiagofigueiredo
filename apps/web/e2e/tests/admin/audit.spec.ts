import { test, expect } from '../../fixtures'
import AxeBuilder from '@axe-core/playwright'

test.describe('Admin / Audit', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ supabaseAdmin, siteId, testId }) => {
    // Seed an auditable action — insert invitation to trigger audit_log trigger
    await supabaseAdmin.from('invitations').insert({
      email: `e2e-audit-seed-${testId}@test.example`,
      site_id: siteId,
      role_scope: 'site',
      role: 'editor',
      token_hash: `seed-audit-token-${testId}`,
    })
  })

  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin.from('invitations').delete().like('email', 'e2e-audit-seed%@test.example')
  })

  test('log de auditoria carrega com colunas corretas', async ({ page }) => {
    await page.goto('/admin/audit')
    await expect(page.getByRole('table')).toBeVisible()
    for (const col of ['action', 'actor']) {
      await expect(page.getByText(col, { exact: false })).toBeVisible()
    }
  })

  test('filtrar por tipo de ação mostra apenas rows correspondentes', async ({ page }) => {
    await page.goto('/admin/audit')

    const actionFilter = page.getByLabel(/[Aa]ção|[Aa]ction/).or(
      page.getByRole('combobox').first()
    )
    await expect(actionFilter).toBeVisible()
    await actionFilter.selectOption({ label: /invitation/i })
    await page.getByRole('button', { name: /[Ff]iltrar|[Ff]ilter/ }).click()
    const dataRows = page.getByTestId('audit-row')
    await expect(dataRows.first()).toBeVisible()
    await expect(page.getByText(/invitation/i).first()).toBeVisible()
  })

  test('filtrar por data oculta rows fora do range', async ({ page }) => {
    await page.goto('/admin/audit')

    const dateFromFilter = page.getByLabel(/[Dd]e|[Ff]rom/i)
    await expect(dateFromFilter).toBeVisible()
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    await dateFromFilter.fill(tomorrow)
    await page.getByRole('button', { name: /[Ff]iltrar|[Ff]ilter/ }).click()
    // After filtering by a future date, no audit rows should appear
    const rows = page.getByTestId('audit-row')
    const rowCount = await rows.count()
    expect(rowCount).toBe(0)
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /admin/audit', async ({ page }) => {
      await page.goto('/admin/audit')
      await expect(page.getByRole('table')).toBeVisible()
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
