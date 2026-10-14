// A5 E5a T5 (tela 16, Canais): os três defeitos do portão do Gio, como teste. Semeia o oráculo e ESTRAGA canais só no banco LOCAL.
// D1 a data de "saiu do YouTube" é a mesma na pastilha e na Direção (missing_since é `date`); D2 a 1440 a tabela cabe no contêiner (sem rolagem lateral);
// D3 cada casa da barra tem preenchimento (não é caixa sem cor). Esperado: D1, D2 e D3 FALHAM até o conserto.
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded } from './fidelity'
import { localServiceClient } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const S = '[data-obs-screen="canais"]'
let saiuId = ''
test.beforeAll(async () => {
  test.setTimeout(240_000)
  await clearSeeded(); await ensureSeeded({ ownPreset: '2' })
  const sb = localServiceClient()
  const { data } = await sb.from('competitor_channels').select('id').neq('sync_status', 'error').order('channel_name').limit(1)
  saiuId = data![0]!.id as string
  await sb.from('competitor_channels').update({ missing_since: '2026-10-04' }).eq('id', saiuId)
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

async function abrir(page: Page, w: number): Promise<void> {
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto('/cms/youtube/competitors')
  await page.locator(`${S} tr.obs-cn-row`).first().waitFor({ timeout: 90_000 })
}

test('D1: saiu do YouTube em 04/10 na pastilha e na Direção', async ({ page }) => {
  test.setTimeout(120_000)
  await abrir(page, 1440)
  const linha = page.locator(`tr.obs-cn-row[data-id="${saiuId}"]`)
  await expect(linha.locator('[data-estado="fora_do_ar"]')).toContainText('04/10')
  await expect(linha).toContainText('saiu do YouTube em 04/10')
})

test('D2: a 1440 a tabela cabe no contêiner (sem rolagem lateral)', async ({ page }) => {
  test.setTimeout(120_000)
  await abrir(page, 1440)
  const m = await page.evaluate(() => { const b = document.querySelector('.tablebox') as HTMLElement; return { cliente: b.clientWidth, rolagem: b.scrollWidth } })
  expect(m.rolagem).toBeLessThanOrEqual(m.cliente + 2)
})

test('D3: as casas da barra têm preenchimento de cor', async ({ page }) => {
  test.setTimeout(120_000)
  await abrir(page, 1440)
  // o filtro de estado usa a cor da superfície; a casa colorida do mockup (verde, neutro, âmbar) tem de se distinguir dela
  const superficie = await page.locator(`${S} .obs-cn-filtro[aria-pressed="false"]`).first().evaluate(e => getComputedStyle(e).backgroundColor)
  for (const nome of [/subindo/, /descendo/]) {
    const bg = await page.locator(`${S} .obs-cn-casa`).filter({ hasText: nome }).first().locator(".obs-cn-casa-b").evaluate(e => getComputedStyle(e).backgroundColor)
    expect(bg, 'casa "' + String(nome) + '" sem cor própria').not.toBe(superficie)
  }
})
