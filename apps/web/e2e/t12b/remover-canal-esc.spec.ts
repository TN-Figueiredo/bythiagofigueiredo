// T12B r3: Esc no diálogo "Remover canal". Semente: canais "T12B C novo 47 imagens" (aviso do Blob + ⓘ) e "T12B D arquivo 3 meses" (rádio apagar desligado).
// Prova o que o jsdom não prova: o Next hidrata no document, então o ouvinte de Esc da tela roda depois do React.
import { test, expect, type Page } from '@playwright/test'

const SHOTS = process.env.T12B_SHOTS ?? 'test-results/t12b-shots'

async function entrar(page: Page) {
  await page.goto('/cms/login?next=%2Fcms%2Fyoutube%2Fcompetitors')
  await page.locator('input[type="email"]').fill('thiago@bythiagofigueiredo.com')
  await page.locator('input[type="password"]').fill('cms-e2e-local-2026')
  await page.waitForFunction(() => !!document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value, null, { timeout: 30_000 })
  await page.locator('button[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

async function abrirDialogo(page: Page, nome: string) {
  await page.goto('/cms/youtube/competitors')
  await page.getByRole('searchbox', { name: 'Buscar canal' }).fill(nome)
  const linha = page.getByRole('row').filter({ hasText: nome }).first()
  await linha.getByRole('button', { name: /Mais ações|⋯|ações/i }).first().click()
  await page.getByRole('menuitem', { name: 'Remover canal…' }).click()
  const dlg = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /^Remover / }) })
  await expect(dlg).toBeVisible()
  return dlg
}

test.describe('Esc no diálogo Remover canal', () => {
  test.beforeEach(async ({ page }) => { await entrar(page) })

  test('Esc com o ⓘ do Blob aberto fecha só o ⓘ (3x)', async ({ page }) => {
    for (let i = 1; i <= 3; i++) {
      const dlg = await abrirDialogo(page, 'T12B C novo 47 imagens')
      await dlg.getByRole('radio', { name: /apagar sem guardar/i }).check()
      const info = dlg.getByRole('button', { name: /Blob/i })
      await info.scrollIntoViewIfNeeded()
      await info.click()
      await expect(info).toHaveAttribute('aria-expanded', 'true')
      await page.screenshot({ path: `${SHOTS}/blob-aberto-${i}.png` })
      await page.keyboard.press('Escape')
      await expect(info).toHaveAttribute('aria-expanded', 'false')
      await expect(dlg).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/blob-esc1-${i}.png` })
      await page.keyboard.press('Escape')
      await expect(dlg).toBeHidden()
    }
  })

  test('Esc sem ⓘ aberto fecha o diálogo', async ({ page }) => {
    const dlg = await abrirDialogo(page, 'T12B D arquivo 3 meses')
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
  })
})
