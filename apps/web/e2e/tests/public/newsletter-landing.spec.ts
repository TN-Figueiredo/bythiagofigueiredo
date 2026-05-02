import { test, expect } from '../../fixtures'

test.describe('Newsletter Landing Page', () => {
  test('renders landing page for valid slug', async ({ page }) => {
    await page.goto('/newsletters/the-bythiago-diary')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('bythiago diary')
    await expect(page.locator('#form-hero')).toBeVisible()
    await expect(page.getByLabel('Your email')).toBeVisible()
    await expect(page.getByRole('checkbox')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible()
  })

  test('shows styled 404 for invalid slug', async ({ page }) => {
    await page.goto('/newsletters/nonexistent-newsletter')
    await expect(page.getByText("That newsletter doesn't exist")).toBeVisible()
  })

  test('breadcrumb shows correct structure', async ({ page }) => {
    await page.goto('/newsletters/the-bythiago-diary')
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb).toBeVisible()
    await expect(breadcrumb.getByText('Home')).toBeVisible()
    await expect(breadcrumb.getByText('Newsletters')).toBeVisible()
  })
})
