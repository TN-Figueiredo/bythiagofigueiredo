import { type Page } from '@playwright/test'

export class AdminShellPage {
  constructor(private readonly page: Page) {}

  async navigateToUsers(): Promise<void> {
    await this.page.getByRole('link', { name: /[Uu]suário|[Uu]ser/ }).click()
    await this.page.waitForURL(/\/admin\/users/)
  }

  async navigateToAudit(): Promise<void> {
    await this.page.getByRole('link', { name: /[Aa]udit/ }).click()
    await this.page.waitForURL(/\/admin\/audit/)
  }

  async navigateToSites(): Promise<void> {
    await this.page.getByRole('link', { name: /[Ss]ite/ }).click()
    await this.page.waitForURL(/\/admin\/sites/)
  }

  async inviteUser(email: string, role: string, siteId?: string): Promise<void> {
    await this.page.getByTestId('admin-users-invite-button').click()
    await this.page.getByLabel(/[Ee]mail/).fill(email)
    await this.page.getByLabel(/[Pp]apel|[Rr]ole/).selectOption(role)
    if (siteId) {
      await this.page.getByLabel(/[Ss]ite/).selectOption(siteId)
    }
    const responsePromise = this.page.waitForResponse(resp => resp.url().includes('/admin/users') && resp.status() < 400)
    await this.page.getByRole('button', { name: /[Cc]onvidar|[Ii]nvite/ }).click()
    await responsePromise
  }

  async revokeInvite(email: string): Promise<void> {
    const row = this.page.getByRole('row').filter({ hasText: email })
    const responsePromise = this.page.waitForResponse(resp => resp.url().includes('/admin/users') && resp.status() < 400)
    await row.getByTestId('admin-users-revoke-button').click()
    await responsePromise
  }
}
