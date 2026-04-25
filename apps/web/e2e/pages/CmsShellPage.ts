import { type Page } from '@playwright/test'

export class CmsShellPage {
  constructor(private readonly page: Page) {}

  async navigateToBlog(): Promise<void> {
    await this.page.getByRole('link', { name: /[Bb]log/ }).click()
    await this.page.waitForURL(/\/cms\/blog/)
  }

  async navigateToCampaigns(): Promise<void> {
    await this.page.getByRole('link', { name: /[Cc]ampanh/i }).click()
    await this.page.waitForURL(/\/cms\/campaigns/)
  }

  async navigateToContacts(): Promise<void> {
    await this.page.getByRole('link', { name: /[Cc]ontat/i }).click()
    await this.page.waitForURL(/\/cms\/contacts/)
  }

  async logout(): Promise<void> {
    await this.page.goto('/cms/logout')
    await this.page.waitForURL(/\/cms\/login/)
  }
}
