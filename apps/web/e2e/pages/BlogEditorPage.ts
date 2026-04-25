import { type Page, expect } from '@playwright/test'

export class BlogEditorPage {
  constructor(private readonly page: Page) {}

  async fillTitle(title: string): Promise<void> {
    await this.page.getByRole('textbox', { name: /^(Título|Title)$/i }).fill(title)
  }

  async fillContent(mdx: string): Promise<void> {
    await this.page.getByRole('textbox', { name: /[Cc]onteúdo|[Cc]ontent/ }).fill(mdx)
  }

  async saveDraft(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/blog') && resp.status() < 400
    )
    await this.page.getByRole('button', { name: /^(Salvar|Save)$/i }).click()
    await responsePromise
  }

  async publish(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/blog') && resp.status() < 400
    )
    await this.page.getByTestId('cms-blog-publish-button').click()
    await responsePromise
  }

  async unpublish(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/blog') && resp.status() < 400
    )
    await this.page.getByTestId('cms-blog-unpublish-button').click()
    await responsePromise
  }

  async schedule(isoDate: string): Promise<void> {
    await this.page.getByRole('button', { name: /[Aa]gendar|[Ss]chedule/ }).click()
    await this.page.getByLabel(/[Dd]ata|[Dd]ate/).fill(isoDate)
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/blog') && resp.status() < 400
    )
    await this.page.getByRole('button', { name: /[Cc]onfirmar|[Cc]onfirm/ }).click()
    await responsePromise
  }

  async archive(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/blog') && resp.status() < 400
    )
    await this.page.getByTestId('cms-blog-archive-button').click()
    await responsePromise
  }

  async delete(): Promise<void> {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/cms/blog') && resp.status() < 400
    )
    await this.page.getByTestId('cms-blog-delete-button').click()
    await this.page.getByRole('button', { name: /[Cc]onfirmar|[Cc]onfirm/ }).click()
    await responsePromise
  }

  async switchLocale(locale: 'pt-BR' | 'en'): Promise<void> {
    const currentUrl = this.page.url()
    const url = new URL(currentUrl)
    url.searchParams.set('locale', locale)
    await this.page.goto(url.toString())
  }

  async expectPublishBlocked(): Promise<void> {
    const btn = this.page.getByTestId('cms-blog-publish-button')
    const visible = await btn.isVisible().catch(() => false)
    if (visible) {
      await expect(btn).toBeDisabled()
    } else {
      // Button not rendered at all — also valid (UI hides publish for reporters)
      await expect(btn).not.toBeVisible()
    }
  }
}
