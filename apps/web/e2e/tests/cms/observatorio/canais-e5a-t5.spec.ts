// A5 E5a T5 (tela 16, Canais): os três defeitos do portão do Gio, como teste. Semeia o oráculo e ESTRAGA canais só no banco LOCAL.
// D1 a data de "saiu do YouTube" é a mesma na pastilha e na Direção (missing_since é `date`); D2 a 1440 a tabela cabe no contêiner (sem rolagem lateral);
// D3 cada casa da barra tem preenchimento (não é caixa sem cor).
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded } from './fidelity'
import { localServiceClient } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const S = '[data-obs-screen="canais"]'
let saiuId = ''
test.beforeAll(async () => {
  test.setTimeout(240_000)
  await clearSeeded()
  const siteId = await ensureSeeded({ ownPreset: '2' })
  const sb = localServiceClient()
  const { data } = await sb.from('competitor_channels').select('id').eq('site_id', siteId).neq('sync_status', 'error').order('channel_name').limit(1)
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

test('D3: cada casa da barra com número tem a cor de fato (a do token da direção), nunca transparente', async ({ page }) => {
  test.setTimeout(120_000)
  await abrir(page, 1440)
  // a casa com n = 0 é transparente de propósito (.z): só as casas com número entram. A cor esperada é a do token, resolvida pelo navegador.
  const token: Record<string, string> = { sobe: '--dir-up', estavel: '--dir-eq', desce: '--dir-dn' }
  let conferidas = 0
  for (const [classe, variavel] of Object.entries(token)) {
    const casa = page.locator(`${S} .obs-cn-casa.${classe}:not(.z):not(.sk)`)
    if ((await casa.count()) === 0) continue
    const { bg, esperado } = await casa.first().locator('.obs-cn-casa-b').evaluate((e, v) => {
      const sonda = document.createElement('div'); sonda.style.background = `var(${v})`; document.querySelector('[data-obs]')!.appendChild(sonda)
      const esperado = getComputedStyle(sonda).backgroundColor; sonda.remove()
      return { bg: getComputedStyle(e).backgroundColor, esperado }
    }, variavel)
    expect(bg, `casa "${classe}" transparente`).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg, `casa "${classe}" com a cor errada`).toBe(esperado)
    conferidas++
  }
  expect(conferidas, 'nenhuma casa com número para conferir').toBeGreaterThan(0)
})
