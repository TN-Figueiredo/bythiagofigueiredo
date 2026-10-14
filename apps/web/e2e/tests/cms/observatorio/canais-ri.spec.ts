// A5 E5a, 2ª leva, R6: Referências e Inscritos na tela Canais, contra o cenário sintético `riCenario` da semente (nicho próprio, 10 concorrentes + o canal próprio).
// 1440 e 390, escuro e claro. Escrito antes da integração (R5): roda depois dela. As frases seguem o plano (R.1): se o modelo (R4) escrever outra, o spec acusa.
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded } from './fidelity'
import { RI_CENARIO, RI_CANAIS, localServiceClient, seedUuid } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
test.describe.configure({ mode: 'serial' })

const N = RI_CENARIO.nomes
const REF = '#referencias', INS = '#inscritos'
const COMBOS: Array<{ w: number; tema: 'dark' | 'light' }> = [
  { w: 1440, tema: 'dark' }, { w: 1440, tema: 'light' }, { w: 390, tema: 'dark' }, { w: 390, tema: 'light' },
]
let siteId = ''
const erros: string[] = []

// ATENÇÃO (Gio, "só desde 19/10" com hoje 14/10): a semente ancora no relógio do oráculo (24/10); o servidor TEM subir pelo playwright.config
// (OBS_E2E=1 + OBS_NOW_OVERRIDE). Um `next dev` já aberto (reuseExistingServer) usa o relógio real e põe as datas no futuro: feche-o antes.
test.beforeAll(async () => {
  test.setTimeout(240_000)
  await clearSeeded()
  siteId = await ensureSeeded({ riCenario: true })
})
// ressemeia ao fim: o caso apagado estraga o canal 5, e `canais-e5a-t5.spec.ts` (mesmo projeto, em série) não pode ver isso
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

async function abrir(page: Page, w: number, tema: 'dark' | 'light'): Promise<void> {
  // sem rede externa: as capas do YouTube respondem 204 (o Gio viu o 404 de i.ytimg.com no console)
  await page.route('**://i.ytimg.com/**', r => r.fulfill({ status: 204, body: '' }))
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()) })
  await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto('/cms/youtube/competitors?niche=' + RI_CENARIO.nicho.slug)
  await page.locator(REF).waitFor({ state: 'attached', timeout: 90_000 })
}
/** A 390 px só a aba escolhida aparece: clica na aba antes de ler a seção. */
async function secao(page: Page, w: number, qual: 'ref' | 'ins'): Promise<void> {
  if (w < 900) await page.locator('.ri-abas').getByRole('button', { name: qual === 'ref' ? 'Referências' : 'Inscritos', exact: true }).click()
}
const linha = (page: Page, sec: string, nome: string) => page.locator(`${sec} .ri-lst > li`, { hasText: nome })
const nomes = (page: Page, sec: string) => page.locator(`${sec} .ri-lst > li .n`).allTextContents()

for (const { w, tema } of COMBOS) {
  test.describe(`${w}px · ${tema}`, () => {
    test('Referências: frase, faixas, provisória, motivos e selo', async ({ page }) => {
      test.setTimeout(180_000)
      await abrir(page, w, tema)
      await secao(page, w, 'ref')
      const frase = page.locator(`${REF} .ri-lead`)
      await expect(frase).toContainText(N.estreita) // a mediana mais alta do cenário (52 a 70 mil)
      await expect(frase).toContainText('Seu canal está em 3º')
      await expect(linha(page, REF, N.larga)).toContainText(/faixa larga/)
      await expect(linha(page, REF, N.larga)).toContainText('12 vídeos')
      await expect(linha(page, REF, N.estreita)).toContainText(/faixa estreita/)
      await expect(linha(page, REF, N.estreita)).toContainText('6 vídeos')
      await expect(linha(page, REF, N.provisoria)).toContainText('provisória · 4 vídeos')
      await expect(linha(page, REF, N.soNovos)).toContainText('sem medida · só vídeos com menos de 7 dias')
      await expect(linha(page, REF, N.primeiraBusca)).toContainText('sem medida · ainda não coletado')
      for (const n of [N.passaArred, N.dentroArred, N.novo, N.oculto, N.buraco]) await expect(linha(page, REF, n)).toContainText('sem medida · sem vídeos em 90 dias')
      await expect(page.locator(`${REF} .ri-lst > li`, { hasText: 'seu canal' })).toHaveCount(1)
    })

    test('Inscritos: frase, motivos de "sem medida", selo e canal próprio', async ({ page }) => {
      test.setTimeout(180_000)
      await abrir(page, w, tema)
      await secao(page, w, 'ins')
      const frase = page.locator(`${INS} .ri-lead`)
      await expect(frase).toContainText(N.passaArred)
      await expect(frase).toContainText('+2,2%')
      await expect(linha(page, INS, N.dentroArred)).toContainText('dentro do arredondamento')
      await expect(linha(page, INS, N.novo)).toContainText('menos de 28 dias')
      await expect(linha(page, INS, N.oculto)).toContainText('contagem oculta')
      await expect(linha(page, INS, N.buraco)).toContainText(/falta a contagem de \d{2}\/\d{2}/)
      await expect(linha(page, INS, N.primeiraBusca)).toContainText('ainda não coletado')
      const proprio = page.locator(`${INS} .ri-lst > li`, { hasText: 'seu canal' })
      await expect(proprio).toHaveCount(1)
      await expect(proprio).toContainText('sem histórico público do seu canal')
      await expect(page.locator(`${INS} .ri-lst > li`, { hasText: N.passaArred })).not.toContainText('sem variação')
    })

    test('ordenar e voltar; "Ver todos"; sem rolagem lateral; sem erro no console', async ({ page }) => {
      test.setTimeout(180_000)
      erros.length = 0
      await abrir(page, w, tema)
      await secao(page, w, 'ref')
      // mediana: estreita, larga, seu canal. Faixa mais estreita: estreita, seu canal, larga
      expect((await nomes(page, REF)).slice(0, 3)).toEqual([N.estreita, N.larga, expect.stringContaining('')])
      await page.locator(REF).getByRole('button', { name: 'Faixa mais estreita' }).click()
      await expect(page.locator(REF).getByRole('button', { name: 'Faixa mais estreita' })).toHaveAttribute('aria-pressed', 'true')
      expect((await nomes(page, REF))[1]).not.toBe(N.larga)
      expect(new URL(page.url()).searchParams.get('ordr')).toBe('faixa')
      await page.locator(REF).getByRole('button', { name: 'Views do vídeo típico' }).click()
      expect((await nomes(page, REF))[1]).toBe(N.larga)
      await secao(page, w, 'ins')
      await page.locator(INS).getByRole('button', { name: 'Ganho em inscritos' }).click()
      await expect(page.locator(INS).getByRole('button', { name: 'Ganho em inscritos' })).toHaveAttribute('aria-pressed', 'true')
      await page.locator(INS).getByRole('button', { name: 'Ganho em %' }).click()
      await expect(page.locator(INS).getByRole('button', { name: 'Ganho em %' })).toHaveAttribute('aria-pressed', 'true')
      if (w >= 900) {
        // Gio 1: "Ver todos os N" só existe abaixo de 900 px; a 1440 a regra da tela (.btn) não pode vencê-la
        await expect(page.locator(REF).getByRole('button', { name: /^Ver todos os \d+$/ })).toBeHidden()
      }
      if (w < 900) {
        await secao(page, w, 'ref')
        const mais = page.locator(REF).getByRole('button', { name: /^Ver todos os \d+$/ })
        await mais.click()
        await expect(page.locator(REF).getByRole('button', { name: 'Ver só os 10 primeiros' })).toHaveAttribute('aria-expanded', 'true')
        await expect(page.locator(`${REF} .ri-lst > li:visible`)).toHaveCount(11)
      }
      const m = await page.evaluate(() => ({ cliente: document.documentElement.clientWidth, rolagem: document.documentElement.scrollWidth }))
      expect(m.rolagem).toBeLessThanOrEqual(m.cliente + 1)
      expect(erros, 'erros de console').toEqual([])
    })
  })
}

// Caso apagado: sem retratos, o canal 5 nunca vira "sem variação" nem "0"
test('dado apagado: sem os retratos do canal "passa o arredondamento", a linha diz "ainda não coletado"', async ({ page }) => {
  test.setTimeout(180_000)
  const sb = localServiceClient()
  const id = seedUuid(siteId, 'channel', RI_CANAIS[5])
  const { error } = await sb.from('competitor_channel_snapshots').delete().eq('competitor_channel_id', id)
  expect(error).toBeNull()
  await abrir(page, 1440, 'dark')
  const l = linha(page, INS, N.passaArred)
  await expect(l).toContainText('ainda não coletado')
  await expect(l).not.toContainText('sem variação')
  await expect(page.locator(`${INS} .ri-lead`)).not.toContainText(N.passaArred)
})
