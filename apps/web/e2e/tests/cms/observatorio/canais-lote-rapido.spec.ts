// A5 E5a, lote rápido da tela Canais (Gio, 15/10): o clique numa casa de Direção tem retorno que o dono VÊ sem rolar à mão.
// Defeito de origem: a lista fica abaixo da dobra e o clique só mudava algo fora da tela. Critério verificável:
//  (a) em até 1 s do clique a casa está aria-pressed=true (anel otimista, antes de o servidor responder);
//  (b) quando a lista filtrada chega (a 390 a casa pode sair da janela; só linha de estado + 1ª linha), a casa ligada, a linha "Mostrando N de M canais · filtro · limpar" e a 1ª linha da lista
//      estão TODAS dentro da janela, sem o teste rolar nada (a página rola sozinha até onde precisa).
// Sem esperas fixas: toBeInViewport / toHaveAttribute repetem até o prazo.
// Semente: oráculo com ownPreset '2' (11 concorrentes "sem mudança") + 30 concorrentes sintéticos só no banco local (20 sem mudança, 10 subindo), de modo que a
// lista filtrada tenha ~31 linhas e a página PRECISE rolar para mostrá-la (com a lista curta a página não rola e o defeito não aparece, sobretudo a 390).
// A direção vem dos retratos do canal (competitor_channel_snapshots: views em D, D-28 e D-56, D = dia do relógio da semente, 24/10/2026).
import { test, expect, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { ADMIN_STATE, clearSeeded, ensureSeeded } from './fidelity'
import { localServiceClient, seedUuid } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const S = '[data-obs-screen="canais"]'
test.beforeAll(async () => {
  test.setTimeout(240_000)
  await clearSeeded()
  const siteId = await ensureSeeded({ ownPreset: '2' })
  const sb = localServiceClient()
  const { data } = await sb.from('competitor_channels').select('*').eq('site_id', siteId).neq('sync_status', 'error').not('last_ok_synced_at', 'is', null).limit(1)
  const base = data![0] as Record<string, unknown>
  const canais: Record<string, unknown>[] = [], retratos: Record<string, unknown>[] = []
  const dias = ['2026-10-24', '2026-09-26', '2026-08-29']
  for (let i = 0; i < 30; i++) {
    const id = seedUuid(siteId, 'channel', `lote-sint-${i}`)
    canais.push({ ...base, id, channel_id: 'UC' + createHash('sha1').update(`lote-sint-${i}`).digest('hex').slice(0, 22), channel_name: `Canal sintético ${String(i).padStart(2, '0')}`,
      subscriber_count: 100_000 + i * 1000, added_at: new Date(Date.parse('2026-09-01T00:00:00Z') + i * 1000).toISOString() })
    const v2 = 1_000_000 + i * 10_000, v1 = v2 + 100_000, v0 = v1 + (i % 3 === 0 ? 150_000 : 100_000) // 150/100 = +50% (subindo); 100/100 = 0% (sem mudança)
    ;[v0, v1, v2].forEach((v, j) => retratos.push({ competitor_channel_id: id, snapshot_date: dias[j], subscriber_count: 100_000 + i * 1000, view_count: v }))
  }
  const a = await sb.from('competitor_channels').insert(canais)
  if (a.error) throw new Error(a.error.message)
  const b = await sb.from('competitor_channel_snapshots').insert(retratos)
  if (b.error) throw new Error(b.error.message)
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

async function abrir(page: Page, w: number, h: number): Promise<void> {
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  await page.setViewportSize({ width: w, height: h })
  await page.goto('/cms/youtube/competitors')
  await page.locator(`${S} .obs-cn-casa`).first().waitFor({ timeout: 90_000 })
  await page.locator(`${S} tr.obs-cn-row, ${S} article.card`).first().waitFor({ timeout: 60_000 })
}

/** Espera a lista parar de se mexer (rolagem suave terminada): a posição do topo da lista igual por 500 ms, no máximo 15 s. */
async function assentou(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(fim => {
    const topo = () => document.querySelector('.tablebox, .cards')!.getBoundingClientRect().top
    let ultimo = topo(), desde = performance.now()
    const inicio = desde
    const quadro = () => {
      const t = topo(), agora = performance.now()
      if (Math.abs(t - ultimo) > 0.5) { ultimo = t; desde = agora }
      if (agora - desde >= 500 || agora - inicio > 15_000) return fim()
      requestAnimationFrame(quadro)
    }
    requestAnimationFrame(quadro)
  }))
}

for (const [w, h] of [[1440, 900], [390, 844]] as const) {
  test(`casa "sem mudança" a ${w}: anel em 1 s e, com a lista filtrada, casa + linha de estado + 1ª linha à vista sem rolar à mão`, async ({ page }) => {
    test.setTimeout(180_000)
    await abrir(page, w, h)
    const casa = page.locator(`${S} .obs-cn-casa.estavel`)
    await expect(casa).toHaveAttribute('aria-pressed', 'false')
    await casa.click()
    // (a) retorno imediato: nada de esperar o servidor
    await expect(casa).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    // (b) a lista filtrada chegou (a URL é a fonte) e a linha de estado diz quantos canais aparecem
    await expect(page).toHaveURL(/direcao=estavel/, { timeout: 60_000 })
    const estado = page.locator(`${S} [data-k="estado-do-filtro"]`)
    await expect(estado).toContainText(/Mostrando \d+ de \d+ canais/, { timeout: 60_000 })
    await expect(estado.getByRole('button', { name: 'limpar' })).toBeVisible()
    // sem rolar: o teste não rola; quem rola é a tela (suave). Espera a rolagem ASSENTAR (a lista parada por 500 ms) e só então confere os três
    // ao mesmo tempo: um instante no meio da rolagem em que os três aparecem não conta (a 1440 existe, e some em seguida).
    await assentou(page)
    const visto = await page.evaluate(() => {
      const aVista = (el: Element | null) => {
        if (!el) return false
        const r = el.getBoundingClientRect(), x = r.left + Math.min(40, r.width / 2), y = r.top + Math.min(24, r.height / 2)
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false
        return el.contains(document.elementFromPoint(x, y)) // à vista E não coberto (barra do topo, painel flutuante, barra de baixo)
      }
      const raiz = document.querySelector('[data-obs-screen="canais"]')!
      return {
        casa: aVista(raiz.querySelector('.obs-cn-casa.estavel')),
        estado: aVista(raiz.querySelector('[data-k="estado-do-filtro"]')),
        primeira: aVista(raiz.querySelector('tr.obs-cn-row[data-id], article.card[data-id]')),
      }
    })
    // 1440: casa + linha de estado + 1ª linha, tudo à vista. 390: a casa pode sair (1.200 px a separam da lista); linha de estado + 1ª linha têm de estar à vista (decisão de 14/10, parecer do Gio)
    if (w >= 1000) expect(visto, 'casa ligada, linha de estado e 1ª linha da lista filtrada, todas à vista ao mesmo tempo').toEqual({ casa: true, estado: true, primeira: true })
    else expect({ estado: visto.estado, primeira: visto.primeira }, 'linha de estado e 1ª linha da lista filtrada à vista (a casa pode sair a 390)').toEqual({ estado: true, primeira: true })
  })
}
