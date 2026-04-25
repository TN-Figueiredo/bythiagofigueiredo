import { type Page, expect } from '@playwright/test'

export class LoginPage {
  constructor(private readonly page: Page) {}

  async login(email: string, password: string): Promise<void> {
    await this.page.locator('input[type="email"]').fill(email)
    await this.page.locator('input[type="password"]').fill(password)
    const responsePromise = this.page.waitForResponse(resp =>
      (resp.url().includes('/auth') || resp.url().includes('/login')) && resp.request().method() === 'POST'
    )
    await this.page.locator('button[type="submit"]').click()
    await responsePromise
  }

  async expectError(): Promise<void> {
    await expect(
      this.page.getByRole('alert').or(this.page.getByTestId('auth-error-message'))
    ).toBeVisible()
  }

  async clickForgotPassword(): Promise<void> {
    await this.page.getByRole('link', { name: /[Ee]squeceu|[Ff]orgot/i }).click()
  }

  async expectGoogleButtonVisible(): Promise<void> {
    await this.page.getByRole('button', { name: /Google/ }).waitFor()
  }
}
