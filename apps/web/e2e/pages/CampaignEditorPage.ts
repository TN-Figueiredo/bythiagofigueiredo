import { type Page, expect } from '@playwright/test'

export class CampaignEditorPage {
  constructor(private readonly page: Page) {}

  async waitForEditor(): Promise<void> {
    await expect(this.page.getByTestId('campaign-meta-form')).toBeVisible()
  }

  async fillTitle(title: string): Promise<void> {
    await this.openSeoSection()
    await this.page.getByLabel(/SEO:\s*(título|title)/i).first().fill(title)
  }

  async openSeoSection(): Promise<void> {
    const details = this.page.getByTestId('campaign-seo-section').or(
      this.page.locator('details').filter({ has: this.page.locator('summary', { hasText: /^SEO$/ }) }).first()
    )
    const isOpen = await details.getAttribute('open')
    if (isOpen === null) {
      await details.locator('summary').click()
    }
  }

  async expectTitleValue(expected: string): Promise<void> {
    await this.openSeoSection()
    await expect(this.page.getByLabel(/SEO:\s*(título|title)/i).first()).toHaveValue(expected)
  }

  async uploadPdf(filePath: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/campaigns') && resp.status() < 400
    )
    await this.page.getByTestId('cms-campaign-upload-pdf-input').setInputFiles(filePath)
    await responsePromise
  }

  async publish(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/campaigns') && resp.status() < 400
    )
    await this.page.getByTestId('cms-campaign-publish-button').click()
    await responsePromise
  }

  async unpublish(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/campaigns') && resp.status() < 400
    )
    await this.page.getByRole('button', { name: /[Dd]espublicar|[Uu]npublish/ }).click()
    await responsePromise
  }

  async delete(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/campaigns') && resp.status() < 400
    )
    await this.page.getByTestId('cms-campaign-delete-button').click()
    await this.page.getByRole('button', { name: /[Cc]onfirmar|[Cc]onfirm/ }).click()
    await responsePromise
  }

  async expectPublishBlocked(): Promise<void> {
    const btn = this.page.getByTestId('cms-campaign-publish-button')
    const visible = await btn.isVisible().catch(() => false)
    if (visible) {
      await expect(btn).toBeDisabled()
    } else {
      // Button not rendered at all — also valid (UI hides publish for reporters)
      await expect(btn).not.toBeVisible()
    }
  }
}
