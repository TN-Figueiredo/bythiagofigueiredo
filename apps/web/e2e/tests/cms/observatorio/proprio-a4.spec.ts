// apps/web/e2e/tests/cms/observatorio/proprio-a4.spec.ts
// A prova, no navegador de verdade, da PÁGINA DO CANAL PRÓPRIO da fase A4 (Tarefa 8). O banco local NÃO tem linha nas tabelas privadas
// (yt_own_video_reach_daily e yt_own_video_daily: a semente é a Tarefa 15), então aqui se prova o que dá com a base atual: a página abre, os
// estados SEM dado dizem o motivo, as abas, os links (vídeo, comparação, ?channel=), o Voltar, 390 e 1440 px, o tema claro. Os estados COM
// dado (impressões, cliques, terceira linha) ficam provados em jsdom com a fixture (proprio-tela.test.tsx).
// Semente: oráculo + cinco canais próprios (ownPreset '2'); `mochila-leve` (inserido aqui) é um canal novo, sem vídeo. Nada é escrito no banco: todo POST de
// server action é abortado e reprova o teste. As medidas vão para test-results/proprio-a4-medidas.txt e para as anotações de cada teste.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { z } from 'zod'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { resetViewerPrefs, localServiceClient, ownSeedUuid, fixarPublicacaoProprio, seedOwnL2, clearOwnL2, ORACLE_NOW, ORFAO_YT_ID, type SeedOptions } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
const MEDIDAS = path.resolve(__dirname, '../../../../test-results/proprio-a4-medidas.txt')
const SHOTS = path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a4')
/** O canal NOVO do dono (sem nenhum vídeo): a semente do oráculo dá vídeos a todos os canais próprios, então ele é inserido aqui, só no banco LOCAL
 *  (localServiceClient recusa outro). O id é um dos que o `clearObservatory` apaga, então o teardown o leva junto. */
async function inserirMochila(siteId: string): Promise<void> {
  const sb = localServiceClient()
  const ins = await sb.from('youtube_channels').upsert({
    id: ownSeedUuid(siteId, 'mochila-leve'), site_id: siteId, channel_id: 'UCmochilaleve0000000000', handle: '@mochilaleve', locale: 'pt', slug: 'mochila-leve', name: 'Mochila Leve (novo)', niche: null,
    uploads_playlist_id: 'UUmochilaleve0000000000', subscriber_count: 3, last_synced_at: new Date().toISOString(), created_at: new Date().toISOString(),
  })
  if (ins.error) throw new Error('canal novo: ' + ins.error.message)
}
test.beforeAll(async () => {
  test.setTimeout(240_000)
  const siteId = await ensureSeeded({ ownPreset: '2' })
  ids = seedIdsOf(siteId)
  await inserirMochila(siteId)
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true })
})
function medida(texto: string): void {
  fs.appendFileSync(MEDIDAS, `[${test.info().title.slice(0, 70)}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const S = '[data-obs-screen="canal"][data-own="1"]'
const ROTA = '/cms/youtube/competitors'
const PROPRIO = () => ids.own('tnfigueiredo')
const SEM_VIDEOS = () => ids.own('mochila-leve')
const url = (qs = '', id = PROPRIO()) => `${ROTA}/canal/${id}${qs}`

let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  intrusos = []; erros = []; cincoXX = []
  await resetViewerPrefs(await getSeedSiteId())
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  // FAIL-CLOSED: toda server action (POST com `next-action`) é abortada e reprova o teste no fim
  await page.context().route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    erros.push(m.text().slice(0, 220) + ' @ ' + loc)
  })
  page.on('pageerror', e => erros.push('pageerror: ' + e.message.slice(0, 220)))
  page.on('response', r => { if (r.status() >= 500) cincoXX.push(r.status() + ' ' + r.url().slice(0, 120)) })
})
test.afterAll(async () => {
  await resetViewerPrefs(await getSeedSiteId())
  await localServiceClient().from('youtube_channels').delete().eq('id', ownSeedUuid(await getSeedSiteId(), 'mochila-leve'))
})
let totalIntrusos = 0
test.afterEach(() => {
  totalIntrusos += intrusos.length
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada (nada chegou ao servidor): ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

async function pronta(page: Page): Promise<void> {
  await page.locator(`${S} .chead h1:visible`).first().waitFor({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
async function abrir(page: Page, qs = '', size?: { width: number; height: number }): Promise<void> {
  if (size) await page.setViewportSize(size)
  await page.goto(url(qs))
  await pronta(page)
}
const query = (page: Page) => new URL(page.url()).searchParams
const tela = (page: Page) => page.locator(`${S}:visible`).first()

/** Medidas de largura: a TELA não rola para o lado (nem o documento, nem o contêiner que rola) e nada do cabeçalho passa da coluna. */
async function larguras(page: Page) {
  return page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0) as HTMLElement
    let sc: HTMLElement = document.documentElement
    for (let p = raiz.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight + 1) { sc = p; break }
    }
    const cx = raiz.getBoundingClientRect()
    const fora: string[] = []
    raiz.querySelectorAll<HTMLElement>('*').forEach(e => {
      if (e.closest('.nclip, .fscroll, .cv-tw, [hidden]') || !e.getClientRects().length) return
      const r = e.getBoundingClientRect()
      // só o que passa da borda DIREITA conta: o `.ntools` recua 10 px à esquerda de propósito (alvo de toque) e o link de pular a lista fica fora da tela por desenho
      if (e.closest('.ctabs, .cv-skip, .ntools') || e.matches('.cv-skip')) return
      if (r.width > 0 && r.right > cx.right + 1) fora.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`)
    })
    // o menor texto visível (px): a regra da casa é 12
    let menor = 99, quem = ''
    raiz.querySelectorAll<HTMLElement>('*').forEach(e => {
      if (!e.getClientRects().length || ![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) return
      const f = parseFloat(getComputedStyle(e).fontSize)
      if (f < menor) { menor = f; quem = `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 20)} "${(e.textContent ?? '').trim().slice(0, 24)}"` }
    })
    return { docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, contScroll: sc.scrollWidth - sc.clientWidth, telaW: Math.round(cx.width), fora: fora.slice(0, 5), menor, quem }
  })
}

test.describe('T8 a página do canal próprio abre com a base de hoje (sem dado privado)', () => {
  test('abre em 200, com o selo "seu canal", a faixa de seis números e a trilha "Canais › nome"; impressões dizem o motivo, nunca 0', async ({ page }) => {
    const r = await page.goto(url())
    expect(r!.status()).toBe(200)
    await pronta(page)
    await expect(tela(page).locator('.chead h1')).not.toBeEmpty()
    await expect(tela(page).locator('.own-seal')).toHaveText('seu canal')
    await expect(page.locator('nav.crumbs:visible li').first()).toContainText('Canais')
    await expect(page.locator('nav.crumbs:visible li[aria-current="page"]')).toHaveText(await tela(page).locator('.chead h1').innerText())
    const rotulos = await tela(page).locator('dl[aria-label="Números do canal"] .nc dt').allInnerTexts()
    expect(rotulos).toHaveLength(6)
    // tabelas privadas vazias: o alcance diz o motivo (banco local), com a cor estável de "não medido"
    const imp = tela(page).locator('dl[aria-label="Números do canal"] .nc').filter({ hasText: 'impressões' }).first()
    // A4 (13.3): a célula sem número leva só o quadradinho hachurado ("não medido", com nome acessível) e o motivo sobe para UMA frase sob a faixa
    await expect(imp.locator('dd.nf .obs-ch-nm')).toHaveAttribute('aria-label', 'não medido')
    await expect(imp.locator('dd.nf')).not.toHaveText(/\d/)
    await expect(tela(page).locator('.nm-fr').first()).toContainText('ainda sem relatório de alcance deste canal')
    // cartões: três colunas, a coluna do meio sem número diz "sem relatório" em .obs-ch-nm; a terceira linha não existe sem leitura
    const cartao = tela(page).locator('ul.cv-grid > li.cv-card').first()
    await expect(cartao.locator('.cv-c.nd .obs-ch-nm').first()).toHaveText('sem relatório')
    await expect(cartao.locator('p.cv-n3')).toHaveCount(0)
    await expect(cartao).not.toContainText(/\b0 impress/)
    // a frase das views por dia: UMA vez, na linha das abas
    // A4 (13.3): o desenho das views por dia existe; sem diário a linha das abas diz o motivo, uma vez só
    await expect(tela(page).getByText('Views por dia: a coleta diária ainda não gravou este canal.')).toHaveCount(1)
    await expect(tela(page).locator('nav.ctabs p.res')).toHaveText('Views por dia: a coleta diária ainda não gravou este canal.')
    medida(`cartões: ${await tela(page).locator('ul.cv-grid > li.cv-card').count()}`)
  })

  test('as abas Trocas, Leitura e Retenção dizem a frase do spec; o Voltar do navegador desfaz a troca de aba', async ({ page }) => {
    await abrir(page)
    const abas = tela(page).locator('nav.ctabs')
    await expect(abas.locator('li a')).toHaveText([/^Vídeos\s*\d+$/, 'Trocas', 'Leitura', 'Retenção'])
    for (const [nome, frase] of [['Trocas', 'Trocas dos seus vídeos ainda não são lidas nesta tela.'], ['Leitura', 'A leitura da forja para o seu canal ainda não existe.'], ['Retenção', 'A coleta diária ainda não rodou para este canal: não há % assistido de nenhum vídeo.']] as const) {
      await abas.getByRole('link', { name: nome }).click()
      // A4 (13.3): a aba Retenção virou "% assistido" e a frase vem na própria aba (`.ret-vazio`), não em `.cv-empty`
      await expect(tela(page).locator(nome === 'Retenção' ? '.ret-vazio p' : '.cv-empty p').first()).toHaveText(frase)
      await expect(tela(page).locator('ul.cv-grid')).toHaveCount(0)
    }
    expect(query(page).get('tab')).toBe('retencao')
    await page.goBack()
    await expect(abas.getByRole('link', { name: 'Leitura' })).toHaveAttribute('aria-current', 'page')
    await page.goBack(); await page.goBack()
    await expect(abas.getByRole('link', { name: /^Vídeos/ })).toHaveAttribute('aria-current', 'page')
    await expect(tela(page).locator('ul.cv-grid > li.cv-card').first()).toBeVisible()
  })

  test('ordenar por impressões e abrir a Retenção: a URL guarda as duas e mudar outra opção não as perde (I2 da Tarefa 7)', async ({ page }) => {
    await abrir(page, '?sort=imp&tab=retencao')
    await expect(tela(page).locator('nav.ctabs a[aria-current="page"]')).toHaveText('Retenção')
    await tela(page).locator('nav.ctabs').getByRole('link', { name: /^Vídeos/ }).click()
    await expect(tela(page).getByRole('combobox', { name: 'Ordenar' })).toHaveValue('imp')
    await tela(page).getByRole('group', { name: 'Formato' }).getByRole('button', { name: /^Longos/ }).click()
    expect(query(page).get('sort')).toBe('imp')
    expect(query(page).get('fmt')).toBe('longos')
    await tela(page).locator('nav.ctabs').getByRole('link', { name: 'Retenção' }).click()
    expect(query(page).get('sort')).toBe('imp')
    expect(query(page).get('tab')).toBe('retencao')
    // recarregar com a URL: o servidor lê como canal próprio (a ordenação por impressões não cai no padrão)
    await page.reload(); await pronta(page)
    await expect(tela(page).locator('nav.ctabs a[aria-current="page"]')).toHaveText('Retenção')
    expect(query(page).get('sort')).toBe('imp')
  })

  test('controles do canal próprio: "Mais impressões no período", sem "Fixados"; a Lista tem Impressões e Cliques no lugar de Views/dia e Trocas', async ({ page }) => {
    await abrir(page)
    const sel = tela(page).getByRole('combobox', { name: 'Ordenar' })
    await expect(sel.locator('option')).toHaveText(['Mais recentes', 'Mais vistos', 'Maior múltiplo', 'Mais impressões no período'])
    await expect(tela(page).getByRole('group', { name: 'Formato' }).getByRole('button')).toHaveCount(3)
    await tela(page).getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Lista' }).click()
    await expect(tela(page).locator('table.cv-lst thead th')).toHaveText(['Vídeo', 'Publicado', 'Views', 'Impressões', 'Múltiplo', 'Curtidas', 'Comentários', 'Cliques', 'Ações'])
    await sel.selectOption('imp')
    // sem relatório nenhum, nenhum vídeo tem impressão: o divisor e a nota miúda dizem a verdade
    await expect(tela(page).locator('tr.cv-grp th').first()).toContainText('Sem impressão medida no período')
    await expect(tela(page).locator('tr.cv-grp small').first()).toHaveText('o vídeo não apareceu nos relatórios de alcance lidos, ou o alcance do canal não pôde ser lido')
  })

  test('o link do cartão leva ao vídeo com canal=, ids=, pos= e tot=; o Voltar traz a página de volta', async ({ page }) => {
    await abrir(page)
    const cartoes = tela(page).locator('ul.cv-grid > li.cv-card')
    const alvo = cartoes.nth(2)
    const id = await alvo.getAttribute('data-id')
    const href = new URL((await alvo.locator('a.cv-lnk').getAttribute('href'))!, 'http://x')
    expect(href.searchParams.get('canal')).toBe(PROPRIO())
    expect(href.searchParams.get('pos')).toBe('3')
    expect(Number(href.searchParams.get('tot'))).toBeGreaterThan(3)
    expect(href.searchParams.get('ids')!.split(',')[2]).toBe(id)
    await alvo.locator('a.cv-lnk').click()
    await page.waitForURL(/\/video\//)
    await page.locator('[data-obs-screen="video-proprio"] h1:visible').first().waitFor({ timeout: 30_000 })
    await page.waitForLoadState('networkidle')      // a tela do vídeo hidrata e grava o último vídeo visto; voltar antes disso não tem o que lembrar
    await page.goBack()
    await pronta(page)
    await expect(page.locator(`${S}:visible a.cv-lnk[id="cv-lnk-${id}"]`)).toBeVisible()
    // T11 fechou a lacuna da T8: a tela do vídeo próprio grava o último vídeo visto, e o Voltar põe o foco no cartão dele
    await expect.poll(() => page.evaluate(id2 => document.activeElement?.id === 'cv-lnk-' + id2, id)).toBe(true)
  })

  test('"Comparar com…" leva à comparação com o concorrente logo acima; o title diz qual; o Voltar devolve o foco ao botão', async ({ page }) => {
    await abrir(page)
    const b = tela(page).locator('.chead .acts [data-comparar-canal]')
    await expect(b).toHaveText('Comparar com…')
    const title = await b.getAttribute('title')
    expect(title).toMatch(/^Abre a comparação com .+, o concorrente (logo acima de você em inscritos|com mais inscritos \(nenhum está acima de você\))$/)
    const href = new URL((await b.getAttribute('href'))!, 'http://x')
    expect(href.pathname).toBe(`${ROTA}/comparar`)
    expect(href.searchParams.get('a')).toBe(PROPRIO())
    expect(href.searchParams.get('b')).not.toBeNull()
    await b.click()
    await page.waitForURL(/\/comparar\?/)
    await page.goBack()
    await pronta(page)
    await expect(page.locator(`${S}:visible [data-comparar-canal]`)).toBeFocused({ timeout: 10_000 })
  })

  test('a linha de posição: só o item COM posição é link (inscritos); mediana, longos e views/dia por mil sem posição são texto', async ({ page }) => {
    await abrir(page)
    const pos = tela(page).locator('.chead p.pos')
    await expect(pos).toContainText('Entre ')
    const links = pos.locator('a')
    // T9 (M1): o banco local não tem diário, então a posição em views/dia por mil não existe e o item não é link; o de inscritos tem posição e é
    await expect(links).toHaveCount(1)
    expect(await links.nth(0).getAttribute('href')).toMatch(/sort=subs/)
    await expect(pos).toContainText('Views/dia por mil inscritos: ')
    await links.nth(0).click()
    await page.waitForURL(/sort=subs/)
    await expect(page.locator('[data-obs-screen="canais"]:visible').first()).toBeVisible()
  })

  test('"Todos os números" abre as treze células e o ⓘ lista a base das 19; as de alcance dizem o motivo', async ({ page }) => {
    await abrir(page)
    await tela(page).getByRole('button', { name: /Todos os números/ }).click()
    // A4 (13.3): 11 viraram 13 (entram a taxa de clique do canal, "views/dia por vídeo" ficou, "% assistido" e "retenção (curva)" são novas); 6 + 13 = 19 no ⓘ
    await expect(tela(page).locator('#canal-nums2 .nc')).toHaveCount(13)
    expect(query(page).get('nums')).toBe('1')
    const cel = tela(page).locator('#canal-nums2 .nc').filter({ hasText: 'cliques estimados' })
    await expect(cel.locator('dd.nf .obs-ch-nm')).toHaveAttribute('aria-label', 'não medido')
    await expect(tela(page).locator('#canal-nums2 .nm-fr')).toContainText('ainda sem relatório de alcance deste canal')
    await tela(page).getByRole('button', { name: 'De onde vêm os números do canal' }).click()
    await expect(page.locator('#canal-tip li')).toHaveCount(19)
  })
})

test.describe('T8 canais sem página, links antigos e atalho "Meu canal"', () => {
  test('canal próprio sem vídeos: status 200, a frase de D10 na moldura, o atalho "Meu canal"; nenhum cartão', async ({ page }) => {
    const r = await page.goto(url('', SEM_VIDEOS()))
    expect(r!.status()).toBe(200)
    await expect(page.locator('[data-obs-screen="canal"]:visible')).toContainText('Este canal ainda não tem vídeos. A página aparece com o primeiro vídeo sincronizado.')
    await expect(page.locator('[data-meu-canal]:visible')).toBeVisible()
    await expect(page.locator('ul.cv-grid')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Voltar para Canais' })).toBeVisible()
  })

  test('?channel=<canal próprio com vídeos> na lista leva à página; ?channel=<sem vídeos> abre a lista sem painel', async ({ page }) => {
    await page.goto(`${ROTA}?channel=${PROPRIO()}`)
    await page.waitForURL(new RegExp(`/canal/${PROPRIO()}`))
    await pronta(page)
    await page.goto(`${ROTA}?channel=${SEM_VIDEOS()}`)
    await page.locator('[data-obs-screen="canais"]:visible').first().waitFor()
    await expect(page.locator('aside.cn-drawer')).toHaveCount(0)
  })

  test('"Abrir meu canal" na lista de Canais leva à página do canal (não ao painel lateral)', async ({ page }) => {
    await page.goto(ROTA)
    await page.locator('[data-obs-screen="canais"]:visible').first().waitFor()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /^Abrir meu canal:/ }).first().click()
    await page.waitForURL(/\/canal\//)
    await pronta(page)
    await expect(tela(page).locator('.own-seal')).toBeVisible()
  })

  test('linha do canal próprio na lista de Canais (I1 da revisão da T8): com vídeos é link da página, sem vídeos não é clicável e diz por quê', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ROTA}?niche=todos`)
    await page.locator('[data-obs-screen="canais"]:visible tbody tr.row').first().waitFor({ timeout: 30_000 })
    await page.waitForLoadState('networkidle')
    const lista = page.locator('[data-obs-screen="canais"]:visible')
    // nenhuma linha tem mais o botão que abria a gaveta
    await expect(lista.locator('button.nmbtn[data-open]')).toHaveCount(0)
    // sem vídeos: o nome é texto, o avatar não é link, a linha diz o motivo; clicar não muda nada
    const sem = lista.locator(`tbody tr.row[data-id="${SEM_VIDEOS()}"]`)
    await sem.scrollIntoViewIfNeeded()
    await expect(sem.locator('a.nmbtn, button.nmbtn, a[data-avatar-link]')).toHaveCount(0)
    await expect(sem.locator('.nmtxt')).toHaveText('Mochila Leve (novo)')
    await expect(sem.getByText('sem vídeos: ainda sem página')).toBeVisible()
    const antes = page.url()
    await sem.locator('.nmtxt').click()
    await page.waitForTimeout(400)
    expect(page.url(), 'clicar no nome do canal sem vídeos não navega').toBe(antes)
    await expect(page.locator('aside.cn-drawer')).toHaveCount(0)
    // com vídeos: link da página, sem lampejo de gaveta; o Voltar volta à lista
    const com = lista.locator(`tbody tr.row[data-id="${PROPRIO()}"] a.nmbtn`)
    await com.scrollIntoViewIfNeeded()
    await expect(com).toHaveAttribute('href', `${ROTA}/canal/${PROPRIO()}`)
    await com.click()
    await page.waitForURL(new RegExp(`/canal/${PROPRIO()}`))
    expect(new URL(page.url()).searchParams.get('channel')).toBeNull()
    await pronta(page)
    await page.goBack()
    await expect.poll(() => new URL(page.url()).pathname).toBe(ROTA)
  })

  test('o atalho "Meu canal" de uma página de canal abre a página do canal escolhido', async ({ page }) => {
    await abrir(page)
    await page.locator('[data-meu-canal] button').first().click()
    const itens = page.locator('#mc-menu a[role="menuitem"]')
    await expect(itens.first()).toBeVisible()
    const hrefs = await itens.evaluateAll(as => as.map(a => a.getAttribute('href')))
    expect(hrefs.filter(h => h && h.includes('/canal/')).length).toBe(2) // os dois com vídeos; o canal novo, sem vídeos, não é link
    expect(hrefs.some(h => h && h.includes('?channel='))).toBe(false)
  })
})

for (const [nome, size] of [['390', { width: 390, height: 844 }], ['1440', { width: 1440, height: 900 }]] as const) {
  test.describe(`T8 ${nome} px`, () => {
    for (const tema of ['dark', 'light'] as const) {
      test(`${nome} px, tema ${tema}: a tela não rola para o lado, nenhum texto abaixo de 12 px, captura salva`, async ({ page }) => {
        await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
        await abrir(page, '', size)
        const l = await larguras(page)
        medida(`${nome}/${tema}: docScroll ${l.docScroll}, contScroll ${l.contScroll}, tela ${l.telaW}px, menor texto ${l.menor}px (${l.quem}), fora: ${l.fora.join(' | ') || 'nenhum'}`)
        expect(l.docScroll, 'rolagem horizontal do documento').toBeLessThanOrEqual(0)
        expect(l.contScroll, 'rolagem horizontal do contêiner').toBeLessThanOrEqual(0)
        expect(l.fora, 'elementos fora da coluna').toEqual([])
        expect(l.menor, `menor texto: ${l.quem}`).toBeGreaterThanOrEqual(12)
        await page.screenshot({ path: path.join(SHOTS, `${nome}-${tema}-capas.png`) })
        await tela(page).getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Lista' }).click()
        await page.waitForTimeout(200)
        const l2 = await larguras(page)
        medida(`${nome}/${tema}/lista: docScroll ${l2.docScroll}, contScroll ${l2.contScroll}`)
        expect(l2.docScroll).toBeLessThanOrEqual(0)
        await page.screenshot({ path: path.join(SHOTS, `${nome}-${tema}-lista.png`) })
        await tela(page).getByRole('button', { name: /Todos os números/ }).click()
        await page.screenshot({ path: path.join(SHOTS, `${nome}-${tema}-todos-os-numeros.png`) })
        await tela(page).locator('nav.ctabs').getByRole('link', { name: 'Retenção' }).click()
        await page.screenshot({ path: path.join(SHOTS, `${nome}-${tema}-retencao.png`) })
      })
    }
  })
}

test('390 px com toque: alvos de 44 px nas abas, no botão de comparar e nos controles do cabeçalho', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await ctx.addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  const page = await ctx.newPage()
  try {
    await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
    await page.goto(url()); await pronta(page)
    const alvos = [`${S} nav.ctabs li a`, `${S} .chead .acts a`, `${S} .chead .nmore`, `${S} .chead .ibtn`, `${S} .cv-ctl .cv-seg button`]
    const pequenos: string[] = []
    for (const sel of alvos) {
      for (const el of await page.locator(sel).elementHandles()) {
        const b = await el.boundingBox()
        if (b && b.width > 0 && Math.min(b.height, b.width) < 43.5) pequenos.push(`${sel} ${Math.round(b.width)}x${Math.round(b.height)}`)
      }
    }
    medida(`alvos de toque menores que 44 px: ${pequenos.length ? pequenos.join(' | ') : 'nenhum'}`)
    expect(pequenos).toEqual([])
  } finally { await ctx.close() }
})

/* ---------------------------------------------------------------- T10 "Como o canal está" (a seção e o gráfico MONTADOS na página, sem dado privado no banco local) */
const SEM_RELATORIO = 'Ainda não há relatório de alcance deste canal.'
const secao = (page: Page) => tela(page).locator('section.pn')
const botaoSecao = (page: Page) => secao(page).getByRole('button', { name: /^Como o canal está/ })

test.describe('T10 a seção "Como o canal está" na página do canal próprio', () => {
  test('nasce RECOLHIDA, acima das abas, com a linha de uma frase: o motivo de não haver alcance e a posição em inscritos', async ({ page }) => {
    await abrir(page)
    await expect(secao(page)).toBeVisible()
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(secao(page).locator('.pn-b')).toBeHidden()
    const linha = secao(page).locator('.pn-r')
    await expect(linha).toContainText(SEM_RELATORIO)
    await expect(linha).toContainText(/\d+º de \d+ canais .*em inscritos\.|Sem posição em inscritos\./)
    await expect(linha).not.toContainText(/\b0 impress/)
    // acima das abas, abaixo do cabeçalho
    const ordem = await tela(page).evaluate(el => {
      const filhos = [...el.children].map(c => c.tagName.toLowerCase() + (c.classList.contains('pn') ? '.pn' : c.classList.contains('ctabs') ? '.ctabs' : c.classList.contains('chead') ? '.chead' : ''))
      return filhos.filter(f => /\.(chead|pn|ctabs)$/.test(f))
    })
    expect(ordem).toEqual(['header.chead', 'section.pn', 'nav.ctabs'])
    // o gráfico nem é desenhado fechado
    await expect(secao(page).locator('svg.ic-svg')).toHaveCount(0)
  })

  test('?painel=1 abre: frase do topo, o gráfico diz o motivo, "Vídeos que mais apareceram" diz o motivo, "No nicho" e "O que ainda não é medido"', async ({ page }) => {
    await abrir(page, '?painel=1')
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'true')
    const corpo = secao(page).locator('.pn-b')
    await expect(corpo).toBeVisible()
    await expect(corpo.locator('.pn-lead')).toHaveCount(0)   // o gráfico já diz a frase: não se repete no topo
    await expect(grafico(page).locator('.ic-vazio')).toHaveText(SEM_RELATORIO)
    // A4 (13.3): o painel ganhou a taxa de clique e o gráfico de views por dia; sem diário o de views diz o motivo dele
    await expect(graficoViews(page).locator('.ic-vazio')).toHaveText('Ainda não há dia medido de views.')
    await expect(corpo.locator('.pn-vazio').filter({ hasText: 'não há vídeo para listar' })).toHaveText('Sem relatório de alcance, não há vídeo para listar.')
    await expect(corpo.locator('.pn-vazio').filter({ hasText: 'não há como calcular a taxa' })).toHaveText('Sem relatório de alcance não há como calcular a taxa.')
    await expect(corpo.getByRole('heading', { level: 3 })).toHaveText(['Taxa de clique do canal', 'Vídeos que mais apareceram', 'No nicho', 'O que ainda não é medido'])
    // "O que ainda não é medido" ficou enxuto: views por dia e % assistido saíram (agora são medidos); sobram a curva e a origem do tráfego
    await expect(corpo.locator('dl.pn-nm dt')).toHaveText(['Curva de retenção', 'Origem do tráfego'])
    await expect(corpo.locator('dl.pn-nm dd')).toHaveText(['ainda não é coletada.', 'ainda não aparece aqui.'])
    await expect(corpo).not.toContainText(/\b(lote|L2|L3|pacote|dataset|day_pt)\b/)
    await expect(corpo).not.toContainText(/\b0 impress/)
  })

  test('clicar abre e fecha, escreve ?painel= na URL e lembra em localStorage; ?painel=0 fecha mesmo com "aberta" lembrada; recarregar respeita a URL', async ({ page }) => {
    await abrir(page)
    await botaoSecao(page).click()
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'true')
    expect(query(page).get('painel')).toBe('1')
    const chave = `obs:como-esta:${PROPRIO()}`
    expect(await page.evaluate(k => localStorage.getItem(k), chave)).toBe('1')
    // recarregar SEM a URL: vale a lembrança
    await page.goto(url()); await pronta(page)
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'true')
    // ?painel=0 vence a lembrança
    await page.goto(url('?painel=0')); await pronta(page)
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'false')
    // fechar com o clique guarda "fechada" e a URL
    await page.goto(url('?painel=1')); await pronta(page)
    await botaoSecao(page).click()
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'false')
    expect(query(page).get('painel')).toBe('0')
    expect(await page.evaluate(k => localStorage.getItem(k), chave)).toBe('0')
    await page.evaluate(k => localStorage.removeItem(k), chave)
  })

  test('trocar de aba e voltar não perde a escolha; só a query mudou (Next não remonta): ?painel= segue a URL', async ({ page }) => {
    await abrir(page, '?painel=1')
    await tela(page).locator('nav.ctabs').getByRole('link', { name: 'Retenção' }).click()
    await expect(tela(page).locator('nav.ctabs a[aria-current="page"]')).toHaveText('Retenção')
    expect(query(page).get('painel')).toBe('1')
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'true')
    await page.goBack()
    await expect(tela(page).locator('nav.ctabs a[aria-current="page"]')).toHaveText(/^Vídeos/)
    await expect(botaoSecao(page)).toHaveAttribute('aria-expanded', 'true')
  })

  test('teclado: Tab chega ao botão da seção, Enter abre e o foco fica nele; o formulário tem DUAS paradas de Tab; mudar o select não navega; o botão leva à comparação', async ({ page }) => {
    await abrir(page)
    const btn = botaoSecao(page)
    await btn.focus()
    await page.keyboard.press('Enter')
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    await expect(btn).toBeFocused()
    const form = secao(page).locator('form.cmpf')
    await expect(form).toHaveAttribute('method', 'get')
    await expect(form.locator('input[type="hidden"][name="a"]')).toHaveValue(PROPRIO())
    const select = form.locator('select[name="b"]')
    await expect(select.locator('option').first()).toContainText('(logo acima de você)')
    // percorrer o corpo com Tab: as duas paradas do formulário são consecutivas (select, botão)
    await select.focus()
    const antes = page.url()
    await page.keyboard.press('ArrowDown')           // seta num select fechado: pode disparar `change`; não pode navegar
    await page.waitForTimeout(400)
    expect(page.url()).toBe(antes)
    await page.keyboard.press('Tab')
    await expect(form.getByRole('button', { name: 'Comparar' })).toBeFocused()
    const escolhido = await select.inputValue()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/comparar\?/)
    const u = new URL(page.url())
    expect(u.pathname).toBe(`${ROTA}/comparar`)
    expect(u.searchParams.get('a')).toBe(PROPRIO())
    expect(u.searchParams.get('b')).toBe(escolhido)
  })

  test('"No nicho": só o item com lista ordenada é link; "Ver a lista de Canais" leva à lista', async ({ page }) => {
    await abrir(page, '?painel=1')
    const nicho = secao(page).locator('.pn-g.two > div').first()
    await expect(nicho.getByRole('heading', { level: 3 })).toHaveText('No nicho')
    const links = await nicho.locator('p.pos a').evaluateAll(as => as.map(a => ({ t: a.textContent, h: a.getAttribute('href') })))
    for (const l of links) expect(l.h).toMatch(/\/competitors\?.*sort=(subs|vpd)/)
    await expect(nicho.getByRole('link', { name: 'Ver a lista de Canais' })).toHaveAttribute('href', new RegExp(`${ROTA}(\\?|$)`))
  })
})

for (const [nome, size] of [['390', { width: 390, height: 844 }], ['1440', { width: 1440, height: 900 }]] as const) {
  test.describe(`T10 a seção aberta a ${nome} px`, () => {
    for (const tema of ['dark', 'light'] as const) {
      test(`${nome} px, tema ${tema}: sem rolagem para o lado, nenhum texto abaixo de 12 px, captura salva`, async ({ page }) => {
        await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
        await abrir(page, '?painel=1', size)
        await expect(secao(page).locator('.pn-b')).toBeVisible()
        const l = await larguras(page)
        medida(`como-esta ${nome}/${tema}: docScroll ${l.docScroll}, contScroll ${l.contScroll}, tela ${l.telaW}px, menor texto ${l.menor}px (${l.quem}), fora: ${l.fora.join(' | ') || 'nenhum'}`)
        expect(l.docScroll, 'rolagem horizontal do documento').toBeLessThanOrEqual(0)
        expect(l.contScroll, 'rolagem horizontal do contêiner').toBeLessThanOrEqual(0)
        expect(l.fora, 'elementos fora da coluna').toEqual([])
        expect(l.menor, `menor texto: ${l.quem}`).toBeGreaterThanOrEqual(12)
        await secao(page).scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(SHOTS, `como-esta-${nome}-${tema === 'light' ? 'claro' : 'escuro'}-aberta.png`) })
        // recolhida (padrão)
        await page.goto(url('?painel=0')); await pronta(page)
        await secao(page).scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(SHOTS, `como-esta-${nome}-${tema === 'light' ? 'claro' : 'escuro'}-recolhida.png`) })
      })
    }
  })
}

test('T10 390 px com toque: o botão da seção, o select, o botão Comparar e os links têm 44 px', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await ctx.addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  const page = await ctx.newPage()
  try {
    await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
    await page.goto(url('?painel=1')); await pronta(page)
    const alvos = [`${S} section.pn .pn-h button`, `${S} section.pn select`, `${S} section.pn form button`, `${S} section.pn .pn-b a[href]`]
    const pequenos: string[] = []
    let vistos = 0
    for (const sel of alvos) {
      for (const el of await page.locator(sel).elementHandles()) {
        const b = await el.boundingBox()
        if (!b || b.width <= 0) continue
        vistos++
        if (Math.min(b.height, b.width) < 43.5) pequenos.push(`${sel} ${Math.round(b.width)}x${Math.round(b.height)}`)
      }
    }
    medida(`como-esta alvos de toque (${vistos} medidos) menores que 44 px: ${pequenos.length ? pequenos.join(' | ') : 'nenhum'}`)
    expect(vistos).toBeGreaterThanOrEqual(4)
    expect(pequenos).toEqual([])
  } finally { await ctx.close() }
})


/* ---------------------------------------------------------------- T11 a página do VÍDEO próprio (banco local sem dado privado: o alcance diz o motivo) */
const V = '[data-obs-screen="video-proprio"]'
const video = (page: Page) => page.locator(`${V}:visible`).first()
const NOTA_SEM_RELATORIO = 'Impressões e cliques deste vídeo: ainda sem relatório de alcance deste canal.'
async function videoPronto(page: Page): Promise<void> {
  await page.locator(`${V} h1:visible`).first().waitFor({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
/** Os ids dos cartões na ordem da página do canal. */
async function idsDosCartoes(page: Page): Promise<string[]> {
  return page.locator(`${S}:visible ul.cv-grid > li.cv-card`).evaluateAll(els => els.map(e => e.getAttribute('data-id')!))
}
/** Abre o vídeo do N-ésimo cartão (1 = primeiro) com um clique de mouse de verdade. */
async function abrirPeloCartao(page: Page, n: number, qs = ''): Promise<string> {
  await abrir(page, qs)
  const ids2 = await idsDosCartoes(page)
  const id = ids2[n - 1]!
  await page.locator(`${S}:visible a#cv-lnk-${id}`).click()
  await page.waitForURL(/\/video\//)
  await videoPronto(page)
  return id
}
const focoId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? '')

test.describe('T11 o vídeo próprio abre, com cabeçalho, faixa e paginador', () => {
  test('clicar no cartão abre a tela nova: selo, título, seis números, um ⓘ só, trilha "Canais › canal › Vídeo", a frase de alcance e o pager na trilha', async ({ page }) => {
    const id = await abrirPeloCartao(page, 3)
    expect(new URL(page.url()).pathname).toContain('/video/' + id)
    const t = video(page)
    await expect(t.locator('h1')).toBeVisible()
    await expect(t.locator('.own-seal')).toHaveText('seu canal')
    await expect(t.locator('dl.nstrip .nc')).toHaveCount(6)
    await expect(t.locator('dl.nstrip .nc dt')).toHaveText([/^views/, /^curtidas/, /^comentários/, /^engajamento/, /^o normal do canal/, /^duração/])
    // A4 (13.4): um ⓘ na faixa de seis e um em cada seção nova (% assistido, retenção, escala das réguas); a nota `data-alcance-nota` (H4) saiu e
    // quem a substitui é a seção "Impressões e cliques", que diz o motivo e o dia não medido
    await expect(t.locator('.vp-nrow .ibtn')).toHaveCount(1)
    await expect(t.locator('.ibtn')).toHaveCount(4)
    await expect(t.locator('[data-alcance-nota]')).toHaveCount(0)
    await expect(t.locator('section[aria-labelledby="vb-imp-h"] .vb-nml p')).toHaveText(SEM_RELATORIO)
    await expect(page.locator('.crumbs li:visible')).toHaveText(['Canais', /.+/, 'Vídeo'])
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('vídeo 3 de ')
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('na ordem da lista: do mais novo ao mais antigo')
    // nenhum número do alcance aparece: o banco local não tem linha nas tabelas privadas
    expect(await t.innerText()).not.toMatch(/impressões? \d|\d+ impressões/)
  })

  test('o ⓘ abre a base dos seis números com a conta feita, e Esc devolve o foco ao botão', async ({ page }) => {
    await abrirPeloCartao(page, 2)
    const b = video(page).locator('.vp-nrow .ibtn')
    await b.click()
    const dlg = page.locator('#flut [role="dialog"]')
    await expect(dlg).toBeVisible()
    await expect(dlg.locator('li')).toHaveCount(6)
    await expect(dlg).toContainText(/\(\d+ curtidas? \+ \d+ comentários?\) ÷ [\d.]+ views = \d+,\d%|Falta a contagem|sem views/)
    await expect(dlg).toContainText(/mediana de views dos outros \d+ vídeos|poucos|sem comparação|mediana dos outros/i)
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    await expect(b).toBeFocused()
  })

  test('"Ampliar thumbnail" abre o visualizador e Esc o fecha com o foco no botão', async ({ page }) => {
    await abrirPeloCartao(page, 1)
    const b = video(page).getByRole('button', { name: 'Ampliar thumbnail' })
    await b.click()
    await expect(page.getByRole('dialog').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(b).toBeFocused()
  })

  test('nas pontas o botão fica na tela, apagado, com o motivo; clicar não navega', async ({ page }) => {
    await abrirPeloCartao(page, 1)
    const ant = page.locator('.obs-tr-aside [data-pager-prev]:visible')
    await expect(ant).toHaveAttribute('aria-disabled', 'true')
    await expect(ant).toHaveAttribute('aria-label', 'Não há vídeo anterior: este é o primeiro da lista')
    const antes = page.url()
    await ant.click({ force: true })      // o Playwright recusa o clique em aria-disabled; força para provar que, mesmo com ele, nada navega
    await page.waitForTimeout(400)
    expect(page.url()).toBe(antes)
    // o último de uma lista pequena (ids= de 3 vídeos tirados da página do canal)
    await abrir(page)
    const [a, b2, c] = (await idsDosCartoes(page)).slice(0, 3)
    await page.goto(`${ROTA}/video/${c}?from=canais&canal=${PROPRIO()}&ids=${a},${b2},${c}&pos=3&tot=3`)
    await videoPronto(page)
    const prox = page.locator('.obs-tr-aside [data-pager-next]:visible')
    await expect(prox).toHaveAttribute('aria-disabled', 'true')
    await expect(prox).toHaveAttribute('aria-label', 'Não há próximo vídeo: este é o último da lista')
    await expect(page.locator('.obs-tr-aside [data-pager-prev]:visible')).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('a ordem do pager é a da lista de onde a pessoa veio (sort=imp): Anterior/Próximo andam pelos ids dos cartões', async ({ page }) => {
    await abrir(page, '?sort=imp')
    const lista = await idsDosCartoes(page)
    await page.locator(`${S}:visible a#cv-lnk-${lista[1]}`).click()
    await page.waitForURL(/\/video\//); await videoPronto(page)
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('vídeo 2 de ')
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('mais impressões primeiro')
    expect(await page.locator('.obs-tr-aside [data-pager-prev]:visible').getAttribute('href')).toContain('/video/' + lista[0])
    expect(await page.locator('.obs-tr-aside [data-pager-next]:visible').getAttribute('href')).toContain('/video/' + lista[2])
    // o item do canal na trilha volta com o back= (a ordenação sobrevive)
    expect(await page.locator('.crumbs li:visible a').nth(1).getAttribute('href')).toContain('sort=imp')
  })

  test('Anterior/Próximo trocam o vídeo sem encher o histórico: UM Voltar leva à página do canal, e o foco vai ao botão usado', async ({ page }) => {
    const lista0 = await (async () => { await abrir(page); return idsDosCartoes(page) })()
    await page.locator(`${S}:visible a#cv-lnk-${lista0[2]}`).click()
    await page.waitForURL(/\/video\//); await videoPronto(page)
    for (let k = 0; k < 3; k++) {
      await page.locator('.obs-tr-aside [data-pager-next]:visible').click()
      await expect(video(page).locator('h1')).not.toHaveText('')
      await page.waitForURL(new RegExp('/video/' + lista0[3 + k]))
      await expect(page.locator('.obs-tr-aside [data-pager-next]:visible')).toBeFocused()
    }
    await expect(video(page).locator('p.obs-ch-sr[role="status"]').first()).toContainText('Vídeo 6 de ')
    await page.goBack()
    await pronta(page)
    expect(new URL(page.url()).pathname).toContain('/canal/')
  })
})

test.describe('T11 o Voltar põe o foco no cartão do ÚLTIMO vídeo visto (pendência da Tarefa 8)', () => {
  test('mouse: cartão → Próximo duas vezes → Voltar do navegador → foco no cartão do vídeo em que a pessoa parou', async ({ page }) => {
    await abrir(page)
    const lista = await idsDosCartoes(page)
    await page.locator(`${S}:visible a#cv-lnk-${lista[1]}`).click()
    await page.waitForURL(/\/video\//); await videoPronto(page)
    await page.locator('.obs-tr-aside [data-pager-next]:visible').click()
    await page.waitForURL(new RegExp('/video/' + lista[2]))
    await page.locator('.obs-tr-aside [data-pager-next]:visible').click()
    await page.waitForURL(new RegExp('/video/' + lista[3]))
    await page.goBack()
    await pronta(page)
    await expect.poll(() => focoId(page), { message: 'foco no cartão do último vídeo visto' }).toBe('cv-lnk-' + lista[3])
  })

  test('mouse: o item do canal na trilha também volta com o foco no cartão', async ({ page }) => {
    await abrir(page)
    const lista = await idsDosCartoes(page)
    await page.locator(`${S}:visible a#cv-lnk-${lista[4]}`).click()
    await page.waitForURL(/\/video\//); await videoPronto(page)
    await page.locator('.crumbs li:visible a').nth(1).click()
    await page.waitForURL(/\/canal\//); await pronta(page)
    await expect.poll(() => focoId(page)).toBe('cv-lnk-' + lista[4])
  })

  test('teclado: Enter no cartão, ] com o foco no título, [ de volta, Enter no item do canal da trilha → foco no cartão', async ({ page }) => {
    await abrir(page)
    const lista = await idsDosCartoes(page)
    await page.locator(`${S}:visible a#cv-lnk-${lista[1]}`).focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/video\//); await videoPronto(page)
    await expect(video(page).locator('h1')).toBeFocused()
    await page.keyboard.press(']')
    await page.waitForURL(new RegExp('/video/' + lista[2]))
    await expect(page.locator('.obs-tr-aside [data-pager-next]:visible')).toBeFocused()
    await page.keyboard.press(']')           // o foco está no pager: continua valendo
    await page.waitForURL(new RegExp('/video/' + lista[3]))
    await expect(page.locator('.obs-tr-aside [data-pager-next]:visible')).toBeFocused()
    await page.keyboard.press('[')
    await page.waitForURL(new RegExp('/video/' + lista[2]))
    await expect(page.locator('.obs-tr-aside [data-pager-prev]:visible')).toBeFocused()
    // [ e ] só valem com o foco no título ou no pager: no botão "Ampliar thumbnail" nada acontece
    await video(page).getByRole('button', { name: 'Ampliar thumbnail' }).focus()
    const antes = page.url()
    await page.keyboard.press(']')
    await page.waitForTimeout(400)
    expect(page.url()).toBe(antes)
    // o item do canal da trilha, por teclado
    const canal = page.locator('.crumbs li:visible a').nth(1)
    await canal.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/canal\//); await pronta(page)
    await expect.poll(() => focoId(page)).toBe('cv-lnk-' + lista[2])
  })

  test('na vista Lista o foco volta à LINHA do vídeo', async ({ page }) => {
    await abrir(page, '?ver=lista')
    const linha = tela(page).locator('table.cv-lst a.cv-tl').nth(2)
    const id = (await linha.getAttribute('id'))!.replace('cv-lnk-', '')
    await linha.click()
    await page.waitForURL(/\/video\//); await videoPronto(page)
    await page.goBack(); await pronta(page)
    await expect.poll(() => focoId(page)).toBe('cv-lnk-' + id)
  })
})

for (const [nome, size] of [['390', { width: 390, height: 844 }], ['1440', { width: 1440, height: 900 }]] as const) {
  for (const tema of ['dark', 'light'] as const) {
    test(`T11 vídeo próprio ${nome} px, tema ${tema}: sem rolagem para o lado, nenhum texto abaixo de 12 px, captura salva`, async ({ page }) => {
      await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
      await page.setViewportSize(size)
      await page.goto(url(''))
      await pronta(page)
      const ids2 = await idsDosCartoes(page)
      await page.goto(`${ROTA}/video/${ids2[2]}?from=canais&canal=${PROPRIO()}&ids=${ids2.slice(0, 8).join(',')}&pos=3&tot=8`)
      await videoPronto(page)
      const l = await larguras(page)
      medida(`vídeo ${nome}/${tema}: docScroll ${l.docScroll}, contScroll ${l.contScroll}, tela ${l.telaW}px, menor texto ${l.menor}px (${l.quem}), fora: ${l.fora.join(' | ') || 'nenhum'}`)
      expect(l.docScroll).toBeLessThanOrEqual(0)
      expect(l.contScroll).toBeLessThanOrEqual(0)
      expect(l.fora).toEqual([])
      expect(l.menor, l.quem).toBeGreaterThanOrEqual(12)
      await page.screenshot({ path: path.join(SHOTS, `video-${nome}-${tema}.png`) })
      await video(page).locator('.vp-nrow .ibtn').click()
      await expect(page.locator('#flut [role="dialog"]')).toBeVisible()
      await page.screenshot({ path: path.join(SHOTS, `video-${nome}-${tema}-i.png`) })
      await page.keyboard.press('Escape')
    })
  }
}

test('T11 390 px com toque: os botões do pager, o ⓘ e as ações têm 44 px', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await ctx.addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  const page = await ctx.newPage()
  try {
    await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
    await page.goto(url()); await pronta(page)
    const lista = await idsDosCartoes(page)
    await page.goto(`${ROTA}/video/${lista[2]}?from=canais&canal=${PROPRIO()}&ids=${lista.slice(0, 5).join(',')}&pos=3&tot=5`)
    await videoPronto(page)
    // a migalha é link de texto da moldura (altura 44, largura do texto): a regra dela é da moldura, não desta tela
    const alvos = [`${V} .ibtn`, `${V} .vp-a .obs-ch-btn`, '.obs-tr-aside .pager .btn']
    const pequenos: string[] = []
    for (const sel of alvos) {
      for (const el of await page.locator(sel).elementHandles()) {
        const b = await el.boundingBox()
        if (b && b.width > 0 && Math.min(b.height, b.width) < 43.5) pequenos.push(`${sel} ${Math.round(b.width)}x${Math.round(b.height)}`)
      }
    }
    medida(`vídeo: alvos de toque menores que 44 px: ${pequenos.length ? pequenos.join(' | ') : 'nenhum'}`)
    expect(pequenos).toEqual([])
  } finally { await ctx.close() }
})


/* ================================================================ T15 o dado privado de verdade (semente ownL2) */
// Até aqui só os estados SEM dado foram vistos num navegador. Daqui para baixo cada bloco semeia um perfil de `ownL2` (cheio, curto, parado, ativo, velho)
// no banco LOCAL e prova as telas das Tarefas 5 a 11 com número real. Os valores esperados saem das LINHAS DO BANCO (somas e contagens feitas aqui,
// nunca copiadas da tela). Cada bloco termina com `clearSeeded()`: as tabelas privadas voltam a ficar vazias mesmo se um teste falhar.
const PT = (n: number): string => n.toLocaleString('pt-BR')
/** A casca que rola é achada pelo script de `addInitScript` do bloco; a função fica em `window.__sc`. */
declare global { interface Window { __sc?: () => HTMLElement } }
const rolagemMain = (page: Page) => page.evaluate(() => window.__sc!().scrollTop)
const rolarMainPara = (page: Page, top: number) => page.evaluate(t => { window.__sc!().scrollTop = t }, top)
const dm = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

const LinhasSchema = z.array(z.record(z.string(), z.unknown()))
interface Privado {
  rels: Array<{ dia: string; status: string; normalizado: boolean }>
  reach: Array<{ ytId: string; videoId: string | null; dia: string; imp: number; ctr: number | null }>
  diario: Array<{ ytId: string; dia: string; views: number }>
}
/** As quatro tabelas do canal próprio lidas direto do banco local (service role): a verdade contra a qual a tela é medida. */
async function lerPrivado(canalOracle = 'tnfigueiredo'): Promise<Privado> {
  const sb = localServiceClient(), siteId = await getSeedSiteId(), canal = ids.own(canalOracle)
  const ler = async (t: string, cols: string) => {
    const r = await sb.from(t).select(cols).eq('site_id', siteId).eq('channel_id', canal).limit(5000)
    if (r.error) throw new Error(t + ': ' + r.error.message)
    return LinhasSchema.parse(r.data)
  }
  return {
    rels: (await ler('yt_reporting_reports', 'status, start_time, normalized_at')).map(r => ({ dia: String(r.start_time).slice(0, 10), status: String(r.status), normalizado: r.normalized_at != null })),
    reach: (await ler('yt_own_video_reach_daily', 'youtube_video_id, video_id, day_pt, thumbnail_impressions, thumbnail_ctr')).map(r => ({ ytId: String(r.youtube_video_id), videoId: r.video_id == null ? null : String(r.video_id), dia: String(r.day_pt), imp: Number(r.thumbnail_impressions), ctr: r.thumbnail_ctr == null ? null : Number(r.thumbnail_ctr) })),
    diario: (await ler('yt_own_video_daily', 'youtube_video_id, day_pt, views')).map(r => ({ ytId: String(r.youtube_video_id), dia: String(r.day_pt), views: Number(r.views) })),
  }
}
/** O que a tela deve dizer, contado das linhas: dias por situação, soma de impressões, cliques estimados (null se algum dia com impressão não tem CTR), views por dia. */
function esperado(p: Privado) {
  const medido = (r: { status: string; normalizado: boolean }) => (r.status === 'baixado' || r.status === 'vazio') && r.normalizado
  const comImp = new Set(p.reach.filter(r => r.imp > 0).map(r => r.dia))
  const dias = [...new Set(p.rels.map(r => r.dia))].sort()
  const naoMedidos = dias.filter(d => !p.rels.some(r => r.dia === d && medido(r)) && !comImp.has(d))
  const zeros = dias.filter(d => p.rels.some(r => r.dia === d && medido(r)) && !comImp.has(d))
  const imp = p.reach.reduce((a, r) => a + r.imp, 0)
  const cliques = p.reach.some(r => r.ctr == null) ? null : Math.round(p.reach.reduce((a, r) => a + r.imp * (r.ctr ?? 0), 0))
  const porDia = new Map<string, number>()
  for (const r of p.reach) porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + r.imp)
  const porVideo = new Map<string, number>()
  for (const r of p.reach) porVideo.set(r.ytId, (porVideo.get(r.ytId) ?? 0) + r.imp)
  const medias = new Map<string, { s: number; n: number }>()
  for (const r of p.diario) { const m = medias.get(r.ytId) ?? { s: 0, n: 0 }; m.s += r.views; m.n++; medias.set(r.ytId, m) }
  const vals = [...medias.values()].filter(m => m.n >= 7).map(m => m.s / m.n).sort((a, b) => a - b)
  const h = vals.length >> 1
  const vpd = vals.length === 0 ? null : vals.length % 2 ? vals[h]! : (vals[h - 1]! + vals[h]!) / 2
  return { dias, comImp: [...comImp].sort(), naoMedidos, zeros, imp, cliques, porDia, porVideo, vpd, nVpd: vals.length, ultimoRel: dias[dias.length - 1] ?? null, primeiroRel: dias[0] ?? null }
}

/** Semeia (só o banco local; o marcador do fidelity evita semear de novo o que já está) e devolve os ids. O canal novo, sem vídeos, entra quando pedido. */
async function semear(seed: SeedOptions, mochila = false): Promise<void> {
  const siteId = await ensureSeeded(seed)
  ids = seedIdsOf(siteId)
  if (mochila) await inserirMochila(siteId)
}
/** Os testes de um bloco de T15: o script de rolagem da casca (`__sc`), e no fim o banco local limpo. */
function blocoT15(nome: string, seed: SeedOptions, corpo: () => void, opcoes: { mochila?: boolean; antes?: () => Promise<void> } = {}): void {
  test.describe(nome, () => {
    test.beforeAll(async () => { test.setTimeout(240_000); await semear(seed, !!opcoes.mochila); await opcoes.antes?.() })
    test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        ;window.__sc = () => {
          const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0) ?? document.querySelector('[data-obs-screen]')
          for (let p = raiz?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
            const o = getComputedStyle(p).overflowY
            if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight + 1) return p
          }
          return (document.scrollingElement ?? document.documentElement) as HTMLElement
        }
      })
    })
    corpo()
  })
}
const SHOTS_DADO = (nome: string) => path.join(SHOTS, `com-dado-${nome}.png`)
// A4: a página tem DUAS figuras `figure.ic` (impressões e, abaixo, views por dia, soma dos vídeos): cada helper pega a sua pelo título
const grafico = (page: Page) => tela(page).locator('figure.ic').filter({ has: page.locator('.ic-t', { hasText: 'Impressões por dia do canal' }) })
const graficoViews = (page: Page) => tela(page).locator('figure.ic').filter({ has: page.locator('.ic-t', { hasText: 'Views por dia, soma dos vídeos' }) })
const grupoGrafico = (page: Page) => grafico(page).locator('.ic-grupo')
/** Abre a página do canal próprio com a seção "Como o canal está" aberta e espera o gráfico desenhado. */
async function abrirComGrafico(page: Page, size?: { width: number; height: number }, qs = '?painel=1'): Promise<void> {
  await abrir(page, qs, size)
  await grafico(page).locator('svg.ic-svg').waitFor({ timeout: 30_000 })
}
/** Caixa de um elemento em relação à janela. */
async function dentroDaJanela(page: Page, sel: string): Promise<{ ok: boolean; txt: string }> {
  return page.evaluate(s => {
    const el = [...document.querySelectorAll<HTMLElement>(s)].find(e => e.getClientRects().length > 0)
    if (!el) return { ok: false, txt: 'sem elemento ' + s }
    const r = el.getBoundingClientRect(), w = document.documentElement.clientWidth, h = window.innerHeight
    return { ok: r.left >= -0.5 && r.right <= w + 0.5 && r.top >= -0.5 && r.bottom <= h + 0.5, txt: `x ${Math.round(r.left)}..${Math.round(r.right)} de ${w}, y ${Math.round(r.top)}..${Math.round(r.bottom)} de ${h}` }
  }, sel)
}

blocoT15('T15 tabelas privadas vazias (sem ownL2): nenhuma frase de número, nenhum 0 inventado', { ownPreset: '2' }, () => {
  test('a página, a lista e a comparação dizem o motivo do dado ausente; as tabelas privadas estão mesmo vazias', async ({ page }) => {
    const p = await lerPrivado()
    expect([p.rels.length, p.reach.length, p.diario.length]).toEqual([0, 0, 0])
    await abrir(page, '?painel=1', { width: 1440, height: 900 })
    await expect(grafico(page).locator('.ic-vazio')).toHaveText(SEM_RELATORIO)
    await expect(grafico(page).locator('svg.ic-svg')).toHaveCount(0)
    const t = await tela(page).innerText()
    expect(t).not.toMatch(/\b0 impress|impressões? de \d|\b0 cliques/)
    await expect(tela(page).locator('dl[aria-label="Números do canal"] .nc').filter({ hasText: 'impressões' }).locator('dd:not(.nsub)')).not.toHaveText(/^\d/)
    // a lista: a célula de views por dia do canal próprio diz o motivo (a coleta ainda não gravou), com o estilo de "não medido", nunca 0
    await page.goto(`${ROTA}?niche=todos`)
    const linha = page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`)
    await linha.waitFor({ timeout: 40_000 })
    await expect(linha).toContainText(/a coleta diária ainda não gravou este canal/i)
    await expect(linha).not.toContainText(/\/dia, n =/)
    // a comparação: o lado do canal próprio diz o mesmo
    await page.goto(`${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`)
    const vpd = page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first()
    await vpd.waitFor({ timeout: 40_000 })
    await expect(vpd.locator('td.cA .obs-ch-nm')).toHaveText('não medido')
    await expect(vpd.locator('td.cA small.why')).toHaveText(/a coleta diária ainda não gravou este canal/i)
  })
}, { mochila: true })

blocoT15('T15 canal próprio com dado cheio (29 dias de relatório; 11 com impressão, 8 vazios, 10 listados)', { ownPreset: '2', ownL2: 'cheio' }, () => {
  test('a página abre com o selo, a faixa de seis e nenhuma célula vazia; impressões e dias vêm das linhas do banco', async ({ page }) => {
    const e = esperado(await lerPrivado())
    expect([e.comImp.length, e.zeros.length, e.naoMedidos.length]).toEqual([11, 8, 10])
    await abrir(page, '', { width: 1440, height: 900 })
    await expect(tela(page).locator('.own-seal')).toHaveText('seu canal')
    const celulas = tela(page).locator('dl[aria-label="Números do canal"] .nc')
    await expect(celulas).toHaveCount(6)
    for (const c of await celulas.all()) {
      await expect(c.locator('dd:not(.nsub)')).not.toBeEmpty()
      await expect(c.locator('dt')).not.toBeEmpty()
    }
    // nenhuma célula da faixa está "não medido": o canal tem relatório e diário
    await expect(tela(page).locator('dl[aria-label="Números do canal"] .obs-ch-nm')).toHaveCount(0)
    const imp = celulas.filter({ hasText: 'impressões' }).first()
    // 3.316 impressões: a soma das linhas do banco, escrita compacta (3,3 mil) e com o período
    expect(e.imp).toBeGreaterThan(1000)
    await expect(imp.locator('dd:not(.nsub)')).toHaveText(new RegExp('^' + (e.imp / 1000).toFixed(1).replace('.', ',') + ' mil$'))
    await expect(imp).toContainText(`de ${dm(e.primeiroRel!)} a ${dm(e.ultimoRel!)}`)
    await expect(celulas.filter({ hasText: 'dias com impressão' }).locator('dd:not(.nsub)')).toHaveText(`${e.comImp.length} de ${e.comImp.length + e.zeros.length}`)
    // os cartões: cada vídeo com impressão mostra o número do banco; "cliques: não medido" onde o CTR faltou
    const cartoes = tela(page).locator('ul.cv-grid > li.cv-card')
    const comImpressoes = await cartoes.filter({ hasText: /impressões/ }).count()
    expect(comImpressoes).toBeGreaterThanOrEqual(1)
    const vistos = await cartoes.evaluateAll(els => els.map(e => (e.textContent ?? '').replace(/\s+/g, ' ')))
    const totais = [...e.porVideo.values()]
    let achados = 0
    for (const tot of totais) if (vistos.some(t => t.includes(PT(tot) + ' impressões') || t.includes(PT(tot) + ' impressão'))) achados++
    medida(`cartões com impressão achados pelo número do banco: ${achados} de ${totais.length}`)
    expect(achados).toBe(totais.length)
    await page.screenshot({ path: SHOTS_DADO('canal-cheio-1440-escuro-recolhido') })
  })

  test('"Como o canal está": a frase diz "em 19 dos 29 dias" (medidos de todos), a soma bate com o banco e os dias não medidos são ditos, não somados', async ({ page }) => {
    const e = esperado(await lerPrivado())
    const medidos = e.comImp.length + e.zeros.length, total = e.dias.length
    await abrir(page, '?painel=0', { width: 1440, height: 900 })
    // recolhida: a linha de uma frase (as contas feitas aqui, não copiadas)
    const linha = secao(page).locator('.pn-r')
    await expect(linha).toContainText(`${PT(e.imp)} impressões em ${medidos} dos ${total} dias`)
    await expect(linha).toContainText('cliques estimados não medidos em algum dia')   // um dia com impressão e CTR nulo: o total de cliques não é inventado
    await expect(linha).not.toContainText(/\b0 impress/)
    await botaoSecao(page).click()
    const g = grafico(page)
    await g.locator('svg.ic-svg').waitFor()
    await expect(g.locator('.ic-res')).toContainText(`${PT(e.imp)} impressões`)
    await expect(g.locator('.ic-res')).toContainText(`${medidos} dias medidos (${e.naoMedidos.length} sem relatório lido)`)
    await expect(g.locator('.ic-res')).toContainText(`${e.comImp.length} dias com impressão e ${e.zeros.length} dias medidos em zero`)
    await expect(g.locator('.ic-per')).toContainText(`de ${dm(e.primeiroRel!)} a ${dm(e.ultimoRel!)} · ${total} dias · dia do YouTube`)
    await expect(g.locator('.ic-avisos li').first()).toHaveText('Dias não medidos não contam como zero nem entram nas somas.')
    // vídeos que mais apareceram: o primeiro é o de mais impressões no banco, com o número do banco
    const ordem = [...e.porVideo.values()].sort((a, b) => b - a)
    const top = secao(page).locator('ol.pn-top li small')
    expect(await top.count()).toBe(Math.min(5, ordem.length))
    for (let k = 0; k < Math.min(5, ordem.length); k++) await expect(top.nth(k)).toContainText(`${PT(ordem[k]!)} impressões`)
    await page.screenshot({ path: SHOTS_DADO('canal-cheio-1440-escuro-aberta') })
    await secao(page).scrollIntoViewIfNeeded()
    await page.screenshot({ path: SHOTS_DADO('canal-cheio-1440-escuro-grafico') })
  })

  for (const [nome, size] of [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]] as const) {
    test(`o gráfico a ${nome} px tem as três formas (barra cheia, caixa vazada, hachura) e cada uma se distingue das outras sem a cor`, async ({ page }) => {
      const e = esperado(await lerPrivado())
      await abrirComGrafico(page, size)
      const formas = await page.evaluate(() => {
        const fig = [...document.querySelectorAll('figure.ic')].find(f => f.getClientRects().length > 0)!
        // luminância de cinza (0 a 255) de uma cor 'rgb(r, g, b)': o que sobra com o filtro de cinza ligado
        const cinza = (c: string): number | null => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? Math.round(0.2126 * +m[1]! + 0.7152 * +m[2]! + 0.0722 * +m[3]!) : null }
        const por: Record<string, { n: number; tipo: string; stroke: string; sw: number; h: number; hMax: number; w: number; cinzaFill: number | null; cinzaStroke: number | null; base: number[] }> = {}
        for (const g of fig.querySelectorAll<SVGGElement>('g.ic-col')) {
          const sit = g.getAttribute('data-situacao')!
          const r = g.querySelector<SVGRectElement>(sit === 'com-impressoes' ? 'rect.ic-bar' : sit === 'zero-medido' ? 'rect.ic-zero' : 'rect.ic-nm')!
          const cs = getComputedStyle(r), bb = r.getBoundingClientRect()
          const tipo = cs.fill.startsWith('url(') ? 'hachura' : cs.fill === 'none' ? 'vazada' : 'cheia'
          const a = por[sit] ?? { n: 0, tipo, stroke: cs.stroke, sw: parseFloat(cs.strokeWidth) || 0, h: bb.height, hMax: 0, w: bb.width, cinzaFill: cinza(cs.fill), cinzaStroke: cinza(cs.stroke), base: [] }
          a.n++; a.hMax = Math.max(a.hMax, bb.height); a.base.push(Math.round(bb.bottom * 10) / 10); por[sit] = a
        }
        // a hachura é um padrão: a cor das linhas e do fundo vêm das classes .ic-hb / .ic-hl (tokens do "não medido")
        const hb = fig.querySelector('.ic-hb'), hl = fig.querySelector('.ic-hl')
        return { por, hachuraFundo: hb ? cinza(getComputedStyle(hb).fill) : null, hachuraLinha: hl ? cinza(getComputedStyle(hl).stroke) : null }
      })
      const P = formas.por
      expect([P['com-impressoes']?.n, P['zero-medido']?.n, P['nao-medido']?.n]).toEqual([e.comImp.length, e.zeros.length, e.naoMedidos.length])
      expect(P['com-impressoes']!.tipo).toBe('cheia')
      expect(P['zero-medido']!.tipo).toBe('vazada')
      expect(P['nao-medido']!.tipo).toBe('hachura')
      // formas diferentes: cheia sobe até a medida; vazada fica baixa (caixa de 6 px) e tem contorno; hachura é um BLOCO baixo, sem contorno
      // (A4, ruling da 13.2 / I4: o mockup aprovado desenha o "não medido" como um bloco de até 24 px assentado na linha de base, e não de cima a baixo)
      expect(P['zero-medido']!.sw, 'a caixa vazada tem contorno').toBeGreaterThan(0)
      expect(P['zero-medido']!.hMax, 'a caixa vazada é baixa').toBeLessThanOrEqual(8)
      expect(P['nao-medido']!.hMax, 'a hachura é um bloco de até 24 px').toBeLessThanOrEqual(24.5)
      expect(P['nao-medido']!.hMax, 'e é mais alta que a caixa vazada: as duas formas não se confundem').toBeGreaterThan(P['zero-medido']!.hMax + 6)
      expect(P['nao-medido']!.hMax, 'e bem mais baixa que a barra cheia: não faz o dia parecer medido').toBeLessThan(P['com-impressoes']!.hMax)
      // o bloco assenta na mesma linha de base da caixa vazada e da barra (nenhum bloco flutua)
      const baseZero = P['zero-medido']!.base[0]!
      for (const b of [...P['nao-medido']!.base, ...P['com-impressoes']!.base]) expect(Math.abs(b - baseZero), 'todas as formas assentam na mesma linha de base').toBeLessThanOrEqual(1)
      expect(P['com-impressoes']!.hMax).toBeGreaterThan(P['zero-medido']!.hMax * 3)
      medida(`formas ${nome}: cheia ${P['com-impressoes']!.n} (até ${P['com-impressoes']!.hMax.toFixed(0)} px), vazada ${P['zero-medido']!.n} (${P['zero-medido']!.hMax.toFixed(1)} px, contorno ${P['zero-medido']!.sw}), hachura ${P['nao-medido']!.n} (${P['nao-medido']!.hMax.toFixed(0)} px); cinza: barra ${P['com-impressoes']!.cinzaFill}, contorno ${P['zero-medido']!.cinzaStroke}, hachura fundo ${formas.hachuraFundo} linha ${formas.hachuraLinha}`)
      // com o filtro de cinza ligado nada muda de forma: as três continuam três formas
      await page.addStyleTag({ content: 'html{filter:grayscale(1)!important}' })
      await grafico(page).scrollIntoViewIfNeeded()
      await page.screenshot({ path: SHOTS_DADO(`grafico-${nome}-cinza`), clip: (await grafico(page).boundingBox()) ?? undefined })
      // as larguras: a coluna não é um fio (a hachura e a barra são visíveis) nem passa da coluna da tela
      const l = await larguras(page)
      expect(l.docScroll).toBeLessThanOrEqual(0)
      expect(l.contScroll).toBeLessThanOrEqual(0)
    })
  }

  test('"Ver como tabela" traz os 29 dias: números do banco, "não medido" nos dias sem relatório lido e "0" nos vazios', async ({ page }) => {
    const e = esperado(await lerPrivado())
    await abrirComGrafico(page, { width: 1440, height: 900 })
    await grafico(page).locator('details.ic-tab summary').click()
    const linhas = grafico(page).locator('details.ic-tab tbody tr')
    await expect(linhas).toHaveCount(e.dias.length)
    await expect(grafico(page).locator('tbody tr[data-situacao="nao-medido"]')).toHaveCount(e.naoMedidos.length)
    await expect(grafico(page).locator('tbody tr[data-situacao="zero-medido"]')).toHaveCount(e.zeros.length)
    for (const tr of await grafico(page).locator('tbody tr[data-situacao="nao-medido"]').all()) {
      await expect(tr.locator('td.num .obs-ch-nm')).toHaveText(['não medido', 'não medido'])
    }
    for (const tr of await grafico(page).locator('tbody tr[data-situacao="zero-medido"]').all()) {
      await expect(tr.locator('td.num').first()).toHaveText('0')
      await expect(tr.locator('td.num .obs-ch-nm')).toHaveCount(0)
    }
    // a soma da coluna de impressões é a do banco, dia a dia
    const doDom = await grafico(page).locator('tbody tr[data-situacao="com-impressoes"]').evaluateAll(trs => trs.map(t => [t.querySelector('th')!.textContent!, t.querySelector('td.num')!.textContent!.replace(/\D/g, '')]))
    expect(doDom).toHaveLength(e.comImp.length)
    expect(doDom.reduce((a, [, n]) => a + Number(n), 0)).toBe(e.imp)
    for (const [rot, n] of doDom) {
      const dia = e.comImp.find(d => dm(d) === rot.trim())
      expect(dia, 'dia ' + rot).toBeDefined()
      expect(Number(n)).toBe(e.porDia.get(dia!))
    }
    // o dia com CTR nulo: cliques "não medido" na tabela, com impressões presentes
    const semCtr = grafico(page).locator('tbody tr[data-situacao="com-impressoes"]').filter({ has: page.locator('td.num >> nth=1 >> .obs-ch-nm') })
    expect(await semCtr.count()).toBe(1)
  })

  for (const [nome, size] of [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]] as const) {
    test(`teclado a ${nome} px: Tab entra uma vez; as setas mudam a dica; a dica fica dentro da janela; Esc fecha; Tab sai`, async ({ page }) => {
      const e = esperado(await lerPrivado())
      await abrirComGrafico(page, size)
      const grupo = grupoGrafico(page)
      // o grupo é UMA parada de Tab: nada dentro dele recebe foco
      await expect(grupo).toHaveAttribute('tabindex', '0')
      await expect(grupo.locator('[tabindex], button, a, input, select')).toHaveCount(0)
      await grafico(page).locator('.ic-info').focus()
      await page.keyboard.press('Tab')
      await expect(grupo).toBeFocused()
      const dica = page.locator('.ic-tip:visible')
      await expect(dica).toBeVisible()
      const t0 = await dica.innerText()
      expect(t0).toContain(dm(e.dias[0]!))          // a primeira coluna: o dia mais antigo do período
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => dica.innerText()).not.toBe(t0)
      expect(await dica.innerText()).toContain(dm(e.dias[1]!))
      await page.keyboard.press('ArrowRight')
      expect(await dica.innerText()).toContain(dm(e.dias[2]!))
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft')
      expect(await dica.innerText()).toBe(t0)
      // a dica de cada passo é falada: a região aria-live carrega o mesmo texto
      await page.keyboard.press('ArrowRight')
      await expect(grafico(page).locator('[aria-live="polite"]')).toHaveText(await dica.innerText())
      // as pontas: a dica da primeira e da última coluna cabem na janela
      for (const [tecla, dia] of [['End', e.dias[e.dias.length - 1]!], ['Home', e.dias[0]!]] as const) {
        await page.keyboard.press(tecla)
        await expect(dica).toContainText(dm(dia))
        const c = await dentroDaJanela(page, '.ic-tip')
        medida(`dica ${tecla} a ${nome}: ${c.txt}`)
        expect(c.ok, 'a dica fica dentro da janela: ' + c.txt).toBe(true)
      }
      // um dia com impressão diz o número do banco; um zero medido diz "0"; um não medido diz o motivo
      const alvoImp = e.comImp[0]!, i = e.dias.indexOf(alvoImp)
      await page.keyboard.press('Home')
      for (let k = 0; k < i; k++) await page.keyboard.press('ArrowRight')
      await expect(dica).toContainText(PT(e.porDia.get(alvoImp)!))
      const iNm = e.dias.indexOf(e.naoMedidos[0]!)
      await page.keyboard.press('Home')
      for (let k = 0; k < iNm; k++) await page.keyboard.press('ArrowRight')
      await expect(dica).toContainText('não medido')
      await page.keyboard.press('Escape')
      await expect(dica).toHaveCount(0)
      await page.keyboard.press('Tab')
      await expect(grupo).not.toBeFocused()
      expect(await page.evaluate(() => document.activeElement?.closest('.ic-grupo') != null), 'o foco saiu do grupo').toBe(false)
      await page.keyboard.press('Shift+Tab')
      await expect(grupo).toBeFocused()   // e volta com UMA parada
    })
  }

  test('toque real a 390 px (hasTouch): o alvo por coluna é medido, tocar numa coluna mostra o dia dela dentro da janela, tocar fora fecha', async ({ browser }) => {
    const e = esperado(await lerPrivado())
    const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    await ctx.addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
    const page = await ctx.newPage()
    const sobra: string[] = []
    page.on('console', m => { if (m.type() === 'error' && !/ytimg|ggpht|blob\.vercel|challenges\.cloudflare/.test(m.location().url + m.text())) sobra.push(m.text().slice(0, 200)) })
    try {
      await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
      await page.context().route('**/*', async route => {
        const r = route.request()
        if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
        await route.fallback()
      })
      await page.goto(url('?painel=1')); await pronta(page)
      await grafico(page).locator('svg.ic-svg').waitFor()
      await grafico(page).scrollIntoViewIfNeeded()
      const hits = await grafico(page).locator('.ic-hit').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }))
      expect(hits).toHaveLength(e.dias.length)
      const larguraCol = hits.map(h => h.w)
      const minW = Math.min(...larguraCol), maxW = Math.max(...larguraCol)
      medida(`TOQUE 390 px: ${hits.length} colunas; alvo por coluna ${minW.toFixed(1)} x ${hits[0]!.h.toFixed(0)} px (largura mínima ${minW.toFixed(1)}, máxima ${maxW.toFixed(1)}); o alvo de 44 px caberia em ${(44 / minW).toFixed(1)} colunas`)
      // toca no centro de colunas espalhadas: a dica traz o dia certo e cabe na janela
      for (const k of [0, 7, 14, 21, e.dias.length - 1]) {
        await grafico(page).scrollIntoViewIfNeeded()
        const h = (await grafico(page).locator('.ic-hit').nth(k).boundingBox())!
        await page.touchscreen.tap(h.x + h.width / 2, h.y + h.height / 2)
        const dica = page.locator('.ic-tip:visible')
        await expect(dica, `toque na coluna ${k}`).toBeVisible()
        await expect(dica).toContainText(dm(e.dias[k]!))
        const c = await dentroDaJanela(page, '.ic-tip')
        expect(c.ok, `a dica da coluna ${k} cabe na janela: ${c.txt}`).toBe(true)
      }
      // a dica fica depois de levantar o dedo e um toque fora a fecha
      await expect(page.locator('.ic-tip:visible')).toBeVisible()
      await page.touchscreen.tap(20, 40)
      await expect(page.locator('.ic-tip:visible')).toHaveCount(0)
      expect(sobra).toEqual([])
    } finally { await ctx.close() }
  })

  test('alvos de toque de 44 px a 390: abas, "Ver como tabela", ⓘ do gráfico, botão da seção (e o do gráfico, medido: ver a medida do toque)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    await ctx.addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
    const page = await ctx.newPage()
    try {
      await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
      await page.goto(url('?painel=1')); await pronta(page)
      await grafico(page).locator('svg.ic-svg').waitFor()
      const alvos = [`${S} nav.ctabs li a`, `${S} figure.ic details.ic-tab summary`, `${S} figure.ic .ic-info`, `${S} section.pn .pn-h button`, `${S} .chead .acts a`]
      const pequenos: string[] = [], lidos: string[] = []
      for (const sel of alvos) {
        for (const el of await page.locator(sel).elementHandles()) {
          const b = await el.boundingBox()
          if (!b || b.width <= 0) continue
          lidos.push(`${sel} ${Math.round(b.width)}x${Math.round(b.height)}`)
          if (Math.min(b.height, b.width) < 43.5) pequenos.push(`${sel} ${Math.round(b.width)}x${Math.round(b.height)}`)
        }
      }
      medida(`alvos 390 medidos: ${lidos.join(' | ')}`)
      medida(`alvos de toque menores que 44 px: ${pequenos.length ? pequenos.join(' | ') : 'nenhum'}`)
      expect(pequenos).toEqual([])
    } finally { await ctx.close() }
  })

  test('cabeçalho recolhido: do topo dele ao topo da seção dentro do que o mockup aprovado mede (197 px na coluna larga, 304 na estreita) e sem rolagem horizontal da página em 1440, 1024, 768 e 390', async ({ page }) => {
    for (const [w, h] of [[1440, 900], [1024, 768], [768, 1024], [390, 844]] as const) {
      await abrir(page, '', { width: w, height: h })
      const alt = await tela(page).locator('header.chead').evaluate(e => Math.round(e.getBoundingClientRect().height))
      // A4: o cabeçalho ganhou a linha-resumo e a segunda linha das células; o desenho aprovado mede a distância do topo do cabeçalho ao topo da seção "Como o canal está"
      // (197 px a 1440 e a 1024, canal.html cheio e magro, recolhido: medido no mockup congelado de 12/10). É essa a distância que a tela tem de respeitar.
      const ateSecao = await tela(page).evaluate(r => Math.round(r.querySelector('section.pn')!.getBoundingClientRect().top - r.querySelector('header.chead')!.getBoundingClientRect().top))
      const l = await larguras(page)
      const sec = await tela(page).locator('section.pn').evaluate(e => Math.round(e.getBoundingClientRect().height))
      medida(`${w} px: cabeçalho ${alt} px, do topo dele ao topo da seção ${ateSecao} px, seção recolhida ${sec} px, docScroll ${l.docScroll}, contScroll ${l.contScroll}, fora: ${l.fora.join(' | ') || 'nenhum'}`)
      expect(l.docScroll, `${w}: rolagem horizontal do documento`).toBeLessThanOrEqual(0)
      expect(l.contScroll, `${w}: rolagem horizontal do contêiner`).toBeLessThanOrEqual(0)
      expect(l.fora, `${w}: elementos fora da coluna`).toEqual([])
      expect(l.menor, `${w}: ${l.quem}`).toBeGreaterThanOrEqual(12)
      // o mockup aprovado: 197 px com a coluna larga (1440) e 304 px quando a coluna estreita (medido a 860, 780 e 700 px no canal.html cheio e magro); a 1024 px a coluna do CMS é estreita
      if (w >= 1024) expect(ateSecao, `${w}: do topo do cabeçalho ao topo da seção, recolhido`).toBeLessThanOrEqual(w >= 1440 ? 197 : 304)
    }
  })

  test('capturas COM dado do canal cheio: 390 escuro, 1440 claro e 390 claro (a de 1440 escuro está nos testes acima)', async ({ page }) => {
    for (const [nome, size, tema] of [['390-escuro', { width: 390, height: 844 }, 'dark'], ['1440-claro', { width: 1440, height: 900 }, 'light'], ['390-claro', { width: 390, height: 844 }, 'light']] as const) {
      await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
      await abrirComGrafico(page, size)
      await page.screenshot({ path: SHOTS_DADO(`canal-cheio-${nome}-aberta`) })
      await grafico(page).scrollIntoViewIfNeeded()
      await page.screenshot({ path: SHOTS_DADO(`canal-cheio-${nome}-grafico`) })
      await tela(page).locator('ul.cv-grid').scrollIntoViewIfNeeded()
      await page.screenshot({ path: SHOTS_DADO(`canal-cheio-${nome}-cartoes`) })
    }
  })

  test('dois canais próprios, um sem vídeos: canal/<o sem vídeos> abre em 200 com a frase de D10 e o menu o lista apagado; o com dado continua inteiro', async ({ page }) => {
    const r = await page.goto(url('', SEM_VIDEOS()))
    expect(r!.status()).toBe(200)
    await expect(page.locator('[data-obs-screen="canal"]:visible')).toContainText('Este canal ainda não tem vídeos. A página aparece com o primeiro vídeo sincronizado.')
    await expect(page.locator('[data-obs-screen="canal"]:visible')).not.toContainText(/impressões/)
    await expect(page.locator('ul.cv-grid')).toHaveCount(0)
    await abrir(page, '', { width: 1440, height: 900 })
    await page.locator('[data-meu-canal] button').first().click()
    const itens = page.locator('#mc-menu [role="menuitem"]')
    await expect(itens.first()).toBeVisible()
    const sem = itens.filter({ hasText: 'Mochila Leve' })
    await expect(sem).toHaveCount(1)
    expect(await sem.getAttribute('href'), 'o canal sem vídeos não é link').toBeNull()
    await expect(sem).toContainText('ainda sem página')
    const com = itens.filter({ hasText: 'tnFigueiredo' }).first()
    expect(await com.getAttribute('href')).toContain(`/canal/${PROPRIO()}`)
    await page.keyboard.press('Escape')
  })
}, { mochila: true })


/** Põe (só no banco local) a publicação dos vídeos do canal próprio em `data do oráculo - dias`: valor ABSOLUTO, então rodar de novo (o Playwright reinicia o worker e o
 *  `beforeAll` volta) dá o mesmo banco. Confere em seguida, lendo o banco, que o vídeo mais novo está de fato na janela esperada: parado (mais de 13 semanas) e dentro do limite. */
async function envelhecerVideos(canalOracle: string, dias: number, preset: SeedOptions['ownPreset'] = '2'): Promise<void> {
  const sb = localServiceClient(), siteId = await getSeedSiteId()
  const esperadoMs = await fixarPublicacaoProprio(siteId, canalOracle, dias, preset, sb)
  const r = await sb.from('youtube_videos').select('published_at').eq('site_id', siteId).eq('channel_id', ids.own(canalOracle))
  if (r.error) throw new Error('youtube_videos: ' + r.error.message)
  const pubs = (r.data as Array<{ published_at: string | null }>).map(v => Date.parse(String(v.published_at))).filter(n => Number.isFinite(n))
  const maisNovo = Math.max(...pubs)
  expect(maisNovo, 'o vídeo mais novo está na data absoluta (oráculo - dias), não deslocado de novo').toBe(esperadoMs)
  const idade = Math.floor((ORACLE_NOW - maisNovo) / 864e5)
  expect(idade, 'canal parado: o vídeo mais novo tem mais de 13 semanas (91 dias)').toBeGreaterThanOrEqual(91)
  expect(idade, 'e não passa de 200 dias + a idade que o vídeo tinha no oráculo (limite do perfil)').toBeLessThanOrEqual(dias + 60)
}
const textoDe = (loc: ReturnType<Page['locator']>) => loc.evaluate(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
const NUM_VPD = (v: number) => new RegExp(`^(${Math.floor(v)}|${Math.ceil(v)})$`)

blocoT15('T15 views por dia reais (canal ativo): a lista, a comparação e o cabeçalho dizem o mesmo número e a mesma janela', { ownPreset: '2', ownL2: 'ativo' }, () => {
  test('o número sai das linhas do diário; a comparação, a lista e o cabeçalho do canal escrevem o MESMO texto e a mesma base', async ({ page }) => {
    const p = await lerPrivado(), e = esperado(p)
    expect(e.vpd).not.toBeNull()
    expect(e.vpd!).toBeGreaterThan(5)
    const ultimo = p.diario.map(r => r.dia).sort().at(-1)!
    const janela = `de ${dm(addDiasStr(ultimo, -27))} a ${dm(ultimo)}`
    await page.setViewportSize({ width: 1440, height: 900 })
    // 1) a comparação
    await page.goto(`${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`)
    const linhaVpd = page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first()
    const linhaMil = page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia por mil inscritos/ }).first()
    await linhaVpd.waitFor({ timeout: 40_000 })
    const cmpVpd = (await textoDe(linhaVpd.locator('td.cA .v1')))
    const cmpMil = (await textoDe(linhaMil.locator('td.cA .v1')))
    expect(cmpVpd).toMatch(NUM_VPD(e.vpd!))
    await expect(linhaVpd.locator('td.cA')).toContainText(`média dos últimos 28 dias do YouTube com medida (${janela}), mediana de ${e.nVpd} longos`)
    await expect(linhaVpd.locator('td.cA .obs-ch-nm')).toHaveCount(0)
    // o concorrente continua com a base dele (outra janela, outra conta), dita na célula dele
    await expect(linhaVpd.locator('td.cB')).toContainText(/views por dia desde \d\d\/\d\d, mediana de \d+ longos/)
    // 2) a lista de Canais
    await page.goto(`${ROTA}?niche=todos`)
    const linha = page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`)
    await linha.waitFor({ timeout: 40_000 })
    const txtLinha = await textoDe(linha)
    expect(txtLinha).toContain(`${cmpVpd}/dia, n = ${e.nVpd}, ${janela}`)
    expect(txtLinha).not.toMatch(/não medido|ainda não gravou/)
    await linha.scrollIntoViewIfNeeded()
    await page.screenshot({ path: SHOTS_DADO('lista-1440-escuro-views-por-dia') })
    // 3) o cabeçalho do canal: "Todos os números" e a linha de posição escrevem os mesmos números
    await page.goto(url()); await pronta(page)
    await tela(page).getByRole('button', { name: /Todos os números/ }).click()
    await expect(tela(page).locator('#canal-nums2 .nc').filter({ hasText: 'views/dia por vídeo' }).locator('dd:not(.nsub)')).toHaveText(cmpVpd)
    await expect(tela(page).locator('.chead p.pos')).toContainText(`Views/dia por mil inscritos: `)
    await expect(tela(page).locator('.chead p.pos')).toContainText(new RegExp(`com ${cmpMil.replace(/[.,]/g, m => '\\' + m)}\\.`))
    medida(`views por dia (mesmo texto): comparação "${cmpVpd}", por mil "${cmpMil}", janela ${janela}, n ${e.nVpd}; esperado do banco ${e.vpd!.toFixed(2)}`)
  })

  test('cinco cliques estimados batem com a soma impressões × CTR do banco (nenhum CTR nulo neste perfil)', async ({ page }) => {
    const e = esperado(await lerPrivado())
    expect(e.cliques).not.toBeNull()
    await abrirComGrafico(page, { width: 1440, height: 900 })
    await expect(grafico(page).locator('.ic-res')).toContainText(`${PT(e.imp)} impressões e ${PT(e.cliques!)} cliques estimados`)
    await tela(page).getByRole('button', { name: /Todos os números/ }).click()
    await expect(tela(page).locator('#canal-nums2 .nc').filter({ hasText: 'cliques estimados' }).locator('dd:not(.nsub)')).toHaveText(PT(e.cliques!))
    await expect(grafico(page).locator('.ic-nm-cl')).toHaveCount(0)   // nenhum dia com impressão ficou sem a medida de cliques
  })

  test('capturas COM dado: o canal (1440 escuro, 390, tema claro) e a comparação', async ({ page }) => {
    for (const [nome, size, tema] of [['1440-escuro', { width: 1440, height: 900 }, 'dark'], ['390-escuro', { width: 390, height: 844 }, 'dark'], ['1440-claro', { width: 1440, height: 900 }, 'light'], ['390-claro', { width: 390, height: 844 }, 'light']] as const) {
      await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
      await abrirComGrafico(page, size)
      await page.screenshot({ path: SHOTS_DADO(`canal-ativo-${nome}-aberta`), fullPage: false })
      await grafico(page).scrollIntoViewIfNeeded()
      await page.screenshot({ path: SHOTS_DADO(`canal-ativo-${nome}-grafico`) })
      await page.goto(`${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`)
      await page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first().waitFor({ timeout: 40_000 })
      await page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: SHOTS_DADO(`comparar-${nome}`) })
    }
  })
})
function addDiasStr(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

blocoT15('T15 série curta (2 dias de relatório e de diário)', { ownPreset: '2', ownL2: 'curto' }, () => {
  test('views por dia diz "menos de 7 dias medidos nos últimos 28" onde o número iria; o gráfico tem 2 colunas e o aviso de pouco dado', async ({ page }) => {
    const p = await lerPrivado(), e = esperado(p)
    expect([e.dias.length, new Set(p.diario.map(r => r.dia)).size]).toEqual([2, 2])
    await abrirComGrafico(page, { width: 1440, height: 900 })
    await expect(grafico(page).locator('g.ic-col')).toHaveCount(2)
    await expect(grafico(page).locator('.ic-avisos')).toContainText('Menos de 7 dias medidos (2): ainda é pouco para ver um padrão.')
    await expect(grafico(page).locator('.ic-res')).not.toContainText(/\b0 impress/)
    await expect(tela(page).locator('.chead p.pos')).toContainText('menos de 7 dias medidos nos últimos 28')
    await page.goto(`${ROTA}?niche=todos`)
    const linha = page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`)
    await linha.waitFor({ timeout: 40_000 })
    await expect(linha).toContainText(/menos de 7 dias medidos nos últimos 28/i)
    await expect(linha).not.toContainText(/\/dia, n =/)
    await expect(linha.locator('.na').first()).toBeVisible()      // a lista usa a célula "na" (A3) para o dado ausente do canal próprio, não a pastilha .obs-ch-nm da página
    await page.goto(`${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`)
    const v = page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first()
    await v.waitFor({ timeout: 40_000 })
    await expect(v.locator('td.cA small.why')).toHaveText('menos de 7 dias medidos nos últimos 28')
    await expect(v.locator('td.cA .obs-ch-nm')).toHaveText('não medido')
    await page.goto(url('?painel=1')); await pronta(page)
    await grafico(page).scrollIntoViewIfNeeded()
    await page.screenshot({ path: SHOTS_DADO('canal-curto-1440-escuro-grafico') })
  })
})

blocoT15('T15 canal parado (29 relatórios vazios, diário de zeros, nenhum vídeo em 13 semanas)', { ownPreset: '2', ownL2: 'parado' }, () => {
  test('views por dia "0" MEDIDO, ritmo "parado: nenhum em 13 semanas", impressões "0"; nada vira "não medido"', async ({ page }) => {
    const p = await lerPrivado(), e = esperado(p)
    expect([e.comImp.length, e.zeros.length, e.naoMedidos.length]).toEqual([0, 29, 0])
    expect(e.vpd).toBe(0)
    await abrirComGrafico(page, { width: 1440, height: 900 })
    // o gráfico: 29 caixas vazadas, nenhuma hachura, nenhuma barra; a frase diz zero medido
    await expect(grafico(page).locator('g.ic-col[data-situacao="zero-medido"]')).toHaveCount(29)
    await expect(grafico(page).locator('g.ic-col[data-situacao="nao-medido"], g.ic-col[data-situacao="com-impressoes"]')).toHaveCount(0)
    await expect(grafico(page).locator('.ic-res')).toContainText('Nenhuma impressão em 29 dias: 0 dias com impressão, 29 dias medidos em zero e 0 dias não medidos.')
    await expect(grafico(page).locator('.ic-nm, .ic-nm-cl')).toHaveCount(0)
    // a faixa: impressões é "0" (valor, não "não medido")
    const imp = tela(page).locator('dl[aria-label="Números do canal"] .nc').filter({ hasText: 'impressões' }).first()
    await expect(imp.locator('dd:not(.nsub)')).toHaveText('0')
    await expect(imp.locator('.obs-ch-nm')).toHaveCount(0)
    await expect(tela(page).locator('dl[aria-label="Números do canal"] .nc').filter({ hasText: 'dias com impressão' }).locator('dd:not(.nsub)')).toHaveText('0 de 29')
    await tela(page).getByRole('button', { name: /Todos os números/ }).click()
    const nums = tela(page).locator('#canal-nums2')
    await expect(nums.locator('.nc').filter({ hasText: 'longos + Shorts por semana' }).locator('dd:not(.nsub)')).toHaveText('parado: nenhum em 13 semanas')
    await expect(nums.locator('.nc').filter({ hasText: 'longos + Shorts por semana' }).locator('.obs-ch-nm')).toHaveCount(0)
    await expect(nums.locator('.nc').filter({ hasText: 'views/dia por vídeo' }).locator('dd:not(.nsub)')).toHaveText('0')
    await expect(nums.locator('.nc').filter({ hasText: 'views/dia por vídeo' }).locator('.obs-ch-nm')).toHaveCount(0)
    await expect(nums.locator('.nc').filter({ hasText: 'cliques estimados' }).locator('dd:not(.nsub)')).toHaveText('0')
    await grafico(page).scrollIntoViewIfNeeded()
    await page.screenshot({ path: SHOTS_DADO('canal-parado-1440-escuro') })
    // a lista: "0/dia, n = …" medido, não "não medido"
    await page.goto(`${ROTA}?niche=todos`)
    const linha = page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`)
    await linha.waitFor({ timeout: 40_000 })
    expect(await textoDe(linha)).toMatch(/0\/dia, n = \d+, de \d\d\/\d\d a \d\d\/\d\d/)
    expect(await textoDe(linha)).not.toMatch(/não medido|ainda não gravou|menos de 7/i)
    // 390 e tema claro
    await page.context().addCookies([{ name: 'btf_theme', value: 'light', url: 'http://localhost:3099' }])
    await abrirComGrafico(page, { width: 390, height: 844 })
    await grafico(page).scrollIntoViewIfNeeded()
    await page.screenshot({ path: SHOTS_DADO('canal-parado-390-claro-grafico') })
    for (const [nome, size, tema] of [['1440-claro', { width: 1440, height: 900 }, 'light'], ['390-escuro', { width: 390, height: 844 }, 'dark']] as const) {
      await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
      await abrirComGrafico(page, size)
      await grafico(page).scrollIntoViewIfNeeded()
      await page.screenshot({ path: SHOTS_DADO(`canal-parado-${nome}-grafico`) })
    }
  })
}, { antes: async () => { await envelhecerVideos('tnfigueiredo', 200); await envelhecerVideos('tnfigueiredo', 200) /* de novo: o worker reiniciado roda o beforeAll outra vez */ } })

blocoT15('T15 coleta parada há 12 dias ("parou em dd/mm")', { ownPreset: '2', ownL2: 'velho' }, () => {
  test('a lista, a comparação e o gráfico dizem em que dia a coleta parou; a série existente continua sendo mostrada', async ({ page }) => {
    const p = await lerPrivado(), e = esperado(p)
    const parou = dm(e.ultimoRel!)
    await abrirComGrafico(page, { width: 1440, height: 900 })
    await expect(grafico(page).locator('.ic-avisos')).toContainText(`A coleta de relatórios deste canal parou em ${parou}.`)
    await expect(secao(page).locator('.pn-r')).toContainText(`A coleta parou em ${parou}.`)
    await page.goto(`${ROTA}?niche=todos`)
    const linha = page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`)
    await linha.waitFor({ timeout: 40_000 })
    await expect(linha).toContainText(new RegExp(`a coleta diária deste canal parou em ${parou}`, 'i'))
    await page.goto(`${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`)
    const v = page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first()
    await v.waitFor({ timeout: 40_000 })
    await expect(v.locator('td.cA small.why')).toHaveText(`a coleta diária deste canal parou em ${parou}`)
    await expect(v.locator('td.cA .obs-ch-nm')).toHaveText('não medido')
  })
})


blocoT15('T15 vídeo próprio com dado: a grade por impressões, o paginador na ordem dela e o Voltar com rolagem e foco', { ownPreset: '2', ownL2: 'cheio' }, () => {
  test('Capas por impressões → vídeo → Próximo → Voltar: a ordem é a da grade (as impressões do banco, da maior para a menor) e o Voltar devolve a rolagem e o foco', async ({ page }) => {
    const e = esperado(await lerPrivado())
    const ordem = [...e.porVideo.entries()].sort((a, b) => b[1] - a[1])
    await abrir(page, '?sort=imp', { width: 1440, height: 900 })
    const cartoes = tela(page).locator('ul.cv-grid > li.cv-card')
    // os primeiros cartões são os vídeos com impressão, do maior para o menor, com o número do banco; os outros não têm impressão medida
    for (let k = 0; k < ordem.length; k++) await expect(cartoes.nth(k)).toContainText(`${PT(ordem[k]![1])} impressões`)
    const idsGrade = await idsDosCartoes(page)
    expect(idsGrade.length).toBeGreaterThan(ordem.length + 1)
    // rola a casca até o 3º cartão ficar a meio da janela e guarda a rolagem
    const alvo = idsGrade[3]!
    await page.locator(`${S}:visible a#cv-lnk-${alvo}`).scrollIntoViewIfNeeded()
    await rolarMainPara(page, (await rolagemMain(page)) + 150)
    const antes = await rolagemMain(page)
    expect(antes).toBeGreaterThan(100)
    await page.locator(`${S}:visible a#cv-lnk-${alvo}`).click()
    await page.waitForURL(/\/video\//); await videoPronto(page)
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('vídeo 4 de ')
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('mais impressões primeiro')
    // com relatório lido a tela NÃO escreve a frase de "ainda sem relatório" (as impressões do vídeo chegam com a Tarefa 13)
    await expect(video(page).locator('[data-alcance-nota]')).toHaveCount(0)
    await page.locator('.obs-tr-aside [data-pager-next]:visible').click()
    await page.waitForURL(new RegExp('/video/' + idsGrade[4]))
    await expect(video(page).locator('h1')).toBeFocused({ timeout: 10_000 }).catch(() => { /* o foco vai ao botão do pager: provado em T11 */ })
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('vídeo 5 de ')
    await expect(video(page).locator('[data-alcance-nota]')).toHaveCount(0)
    await page.goBack()
    await pronta(page)
    await expect.poll(() => focoId(page), { message: 'foco no cartão do último vídeo visto (o 5º)' }).toBe('cv-lnk-' + idsGrade[4])
    const depois = await rolagemMain(page)
    medida(`Voltar com dado: rolagem ${antes} -> ${depois}; foco no cartão ${idsGrade[4]}`)
    // a rolagem volta à de ANTES de abrir o 4º vídeo (medido: 150 -> 150)
    expect(Math.abs(depois - antes), `rolagem antes ${antes} depois ${depois}`).toBeLessThanOrEqual(8)
    await expect(page.locator(`${S}:visible a#cv-lnk-${idsGrade[4]}`)).toBeInViewport()
  })

  test('o paginador anda na ordem dos ids da grade também com sort=imp: Anterior e Próximo apontam para os vizinhos; a primeira ponta fica apagada', async ({ page }) => {
    await abrir(page, '?sort=imp', { width: 1440, height: 900 })
    const lista = await idsDosCartoes(page)
    await page.locator(`${S}:visible a#cv-lnk-${lista[0]}`).click()
    await page.waitForURL(/\/video\//); await videoPronto(page)
    await expect(page.locator('.obs-tr-aside [data-pager-prev]:visible')).toHaveAttribute('aria-disabled', 'true')
    expect(await page.locator('.obs-tr-aside [data-pager-next]:visible').getAttribute('href')).toContain('/video/' + lista[1])
    await page.screenshot({ path: SHOTS_DADO('video-1440-escuro-com-alcance') })
  })

  test('com relatório lido o vídeo próprio não repete "ainda sem relatório" e não inventa "0 impressões"; a faixa tem seis números; as impressões do vídeo ficam para a Tarefa 13', async ({ page }) => {
    const e = esperado(await lerPrivado())
    await abrir(page, '?sort=imp', { width: 1440, height: 900 })
    const lista = await idsDosCartoes(page)
    for (const k of [0, e.porVideo.size + 2]) {
      await page.locator(`${S}:visible a#cv-lnk-${lista[k]}`).click()
      await page.waitForURL(/\/video\//); await videoPronto(page)
      await expect(video(page).locator('[data-alcance-nota]')).toHaveCount(0)
      await expect(video(page).locator('dl.nstrip .nc')).toHaveCount(6)
      for (const c of await video(page).locator('dl.nstrip .nc').all()) await expect(c.locator('dd')).not.toBeEmpty()
      const t = await textoDe(video(page))
      medida(`vídeo ${k === 0 ? 'com' : 'sem'} impressões no relatório: a tela não escreve impressões (${/impress/i.test(t) ? 'ESCREVE' : 'nada'})`)
      expect(t).not.toMatch(/\b0 impress|ainda sem relatório de alcance/)
      await page.screenshot({ path: SHOTS_DADO(k === 0 ? 'video-1440-escuro-com-alcance-no-canal' : 'video-1440-escuro-fora-do-alcance') })
      await page.goBack(); await pronta(page)
    }
  })

  test('390 px, tema escuro e claro: o vídeo com dado não rola para o lado e o texto tem 12 px ou mais; capturas salvas', async ({ page }) => {
    for (const tema of ['dark', 'light'] as const) {
      await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
      await abrir(page, '?sort=imp', { width: 390, height: 844 })
      const lista = await idsDosCartoes(page)
      await page.goto(`${ROTA}/video/${lista[0]}?from=canais&canal=${PROPRIO()}&ids=${lista.slice(0, 8).join(',')}&pos=1&tot=8`)
      await videoPronto(page)
      const l = await larguras(page)
      medida(`vídeo com dado 390/${tema}: docScroll ${l.docScroll}, contScroll ${l.contScroll}, menor texto ${l.menor}px (${l.quem}), fora: ${l.fora.join(' | ') || 'nenhum'}`)
      expect(l.docScroll).toBeLessThanOrEqual(0)
      expect(l.contScroll).toBeLessThanOrEqual(0)
      expect(l.fora).toEqual([])
      expect(l.menor, l.quem).toBeGreaterThanOrEqual(12)
      await page.screenshot({ path: SHOTS_DADO(`video-390-${tema === 'dark' ? 'escuro' : 'claro'}`) })
    }
  })
})

blocoT15('T15 cinco canais próprios (preset 5): a lista posiciona cada um; a comparação de dois canais seus mostra dois cartões e cada lado diz o que tem', { ownPreset: '5', ownL2: 'cheio' }, () => {
  const CINCO = ['tnfigueiredo', 'tnfigueiredo-en', 'thiago-na-estrada', 'slow-roads', 'mochila-leve']
  test('a lista de Canais tem as cinco linhas "seu canal", cada uma com posição; só a do canal com relatório mostra views por dia', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ROTA}?niche=todos`)
    await page.locator('[data-obs-screen="canais"]:visible tbody tr.row.you').first().waitFor({ timeout: 40_000 })
    await page.waitForLoadState('networkidle')
    const lista = page.locator('[data-obs-screen="canais"]:visible')
    await expect(lista.locator('tbody tr.row.you')).toHaveCount(5)
    for (const c of CINCO) {
      const linha = lista.locator(`tbody tr.row[data-id="${ids.own(c)}"]`)
      await expect(linha, c).toHaveCount(1)
      await expect(linha.locator('.youtag')).toHaveText('seu canal')
      expect(await textoDe(linha), c).toMatch(/^(\d+º|sem posição)/)
    }
    // só o primeiro tem diário: os outros quatro dizem o motivo, nunca um número
    for (const c of CINCO.slice(1)) {
      const t = await textoDe(lista.locator(`tbody tr.row[data-id="${ids.own(c)}"]`))
      expect(t, c).toMatch(/a coleta diária ainda não gravou este canal/i)
      expect(t, c).not.toMatch(/\/dia, n =/)
    }
    expect(await textoDe(lista.locator(`tbody tr.row[data-id="${PROPRIO()}"]`))).toMatch(/0\/dia, n = \d+, de \d\d\/\d\d a \d\d\/\d\d/)
    await lista.locator('tbody tr.row.you').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: SHOTS_DADO('lista-5-canais-1440-escuro') })
  })

  test('as páginas dos cinco canais abrem em 200; os quatro sem relatório dizem o motivo no gráfico, o primeiro desenha o dele', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const c of CINCO) {
      const r = await page.goto(url('?painel=1', ids.own(c)))
      expect(r!.status(), c).toBe(200)
      await page.locator(`${S} .chead h1:visible, [data-obs-screen="canal"]:visible`).first().waitFor({ timeout: 30_000 })
      await page.waitForLoadState('networkidle')
      if (c === 'tnfigueiredo') await expect(grafico(page).locator('g.ic-col')).toHaveCount(29)
      else await expect(grafico(page).locator('.ic-vazio')).toHaveText(SEM_RELATORIO)
    }
  })

  test('a comparação de dois canais seus: dois cartões "seu canal"; o lado com diário traz o número, o outro diz o motivo; nada de 5xx', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ROTA}/comparar?a=${ids.own('tnfigueiredo')}&b=${ids.own('tnfigueiredo-en')}`)
    const tabela = page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first()
    await tabela.waitFor({ timeout: 40_000 })
    await expect(page.locator('[data-obs-screen]:visible').getByText('seu canal', { exact: true })).toHaveCount(2)
    await expect(page.getByRole('link', { name: /^Abrir o canal / })).toHaveCount(2)
    await expect(tabela.locator('td.cA .v1')).toHaveText('0')
    await expect(tabela.locator('td.cB .obs-ch-nm')).toHaveText('não medido')
    await expect(tabela.locator('td.cB small.why')).toHaveText(/a coleta diária ainda não gravou este canal/i)
    await page.screenshot({ path: SHOTS_DADO('comparar-2-proprios-1440-escuro') })
  })
})

blocoT15('T15 sem canal próprio (o site novo): nenhum atalho "Meu canal"; o canal de um concorrente abre como antes', { ownPreset: '1' }, () => {
  test('sem nenhum canal próprio a lista, a página do concorrente e a comparação de dois concorrentes abrem sem erro e sem nada da A4', async ({ page }) => {
    // o site NOVO: o preset '1' traz um canal próprio; ele sai daqui (só o banco local), sem tocar no resto
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ROTA}?niche=todos`)
    await page.locator('[data-obs-screen="canais"]:visible tbody tr.row').first().waitFor({ timeout: 40_000 })
    await expect(page.locator('[data-obs-screen="canais"]:visible tbody tr.row.you')).toHaveCount(0)
    await expect(page.locator('[data-meu-canal]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Abrir meu canal:/ })).toHaveCount(0)
    // o concorrente: a página do canal é a de sempre (sem o selo, sem a seção de impressões)
    const r = await page.goto(`${ROTA}/canal/${ids.channel('matt-wolfe')}`)
    expect(r!.status()).toBe(200)
    await page.locator('[data-obs-screen="canal"]:visible .chead h1').first().waitFor({ timeout: 40_000 })
    await expect(page.locator('[data-obs-screen="canal"]:visible .own-seal')).toHaveCount(0)
    await expect(page.locator('[data-obs-screen="canal"]:visible section.pn')).toHaveCount(0)
    await expect(page.locator('[data-obs-screen="canal"][data-own="1"]')).toHaveCount(0)
    // a comparação de dois concorrentes
    await page.goto(`${ROTA}/comparar?a=${ids.channel('matt-wolfe')}&b=${ids.channel('nate-herk')}`)
    await page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Inscritos/ }).first().waitFor({ timeout: 40_000 })
    expect(await page.locator('[data-obs-screen]:visible').first().innerText()).not.toMatch(/seu canal/)
    // o link antigo do canal próprio que deixou de existir é "não encontrado", não erro
    const sumido = await page.goto(`${ROTA}/canal/${ids.own('tnfigueiredo')}`)
    expect(sumido!.status()).toBeLessThan(500)
  })
}, { antes: async () => {
  const sb = localServiceClient(), siteId = await getSeedSiteId(), own = ownSeedUuid(siteId, 'tnfigueiredo')
  for (const [t, col] of [['youtube_videos', 'channel_id'], ['youtube_channels', 'id']] as const) {
    const d = await sb.from(t).delete().eq('site_id', siteId).eq(col, own)
    if (d.error) throw new Error('sem canal próprio: ' + d.error.message)
  }
} })

/* ---- quem só lê (reporter): as sentinelas do dado privado, em todas as formas em que podem viajar */
type Tela = 'lista' | 'comparação' | 'canal' | 'vídeo'
type Onde = 'html' | 'dom' | 'rede'
/** Tudo o que uma pessoa (ou o navegador dela) recebe de uma tela: o HTML bruto do servidor, o DOM depois de hidratar (HTML vivo + texto visível) e todas as respostas de rede
 *  que NÃO são o documento (fetch/xhr, flight RSC, resposta de server action), mais a carga RSC pedida direto (cabeçalho `RSC: 1`). */
interface Fonte { html: string; dom: string; rede: string }
const abrev = (n: number): string => {
  const dec = (x: number) => { const r = Math.round(x * 10) / 10; return (r % 1 === 0 ? String(r) : r.toFixed(1)).replace('.', ',') }
  const a = Math.abs(n)
  return a < 1000 ? String(Math.round(a)) : a < 1e6 ? dec(a / 1e3) + ' mil' : dec(a / 1e6) + ' mi'
}
/** O número cru, com separador de milhar e abreviado como a tela escreve ("3,3 mil"). */
const formasNum = (n: number): string[] => (n >= 1000 ? [String(n), PT(n), abrev(n)] : [String(n)])
const unicos = (a: string[]): string[] => [...new Set(a)]
interface Sentinela { grupo: string; formas: string[] }
function sentinelas(p: Privado, e: ReturnType<typeof esperado>, canalUuid: string): Sentinela[] {
  const ctrs = unicos(p.reach.filter(r => r.ctr != null).map(r => String(r.ctr)))
  const viewsPorVideo = new Map<string, number>()
  for (const r of p.diario) viewsPorVideo.set(r.ytId, (viewsPorVideo.get(r.ytId) ?? 0) + r.views)
  const vpd = e.vpd!
  const pref = canalUuid.slice(0, 8)
  return [
    { grupo: 'soma das impressões', formas: formasNum(e.imp) },
    { grupo: 'cliques estimados', formas: formasNum(e.cliques!) },
    { grupo: 'impressões por vídeo', formas: unicos([...e.porVideo.values()].flatMap(formasNum)) },
    { grupo: 'impressões por dia', formas: unicos([...e.porDia.values()].flatMap(formasNum)) },
    { grupo: 'CTR (fração com ponto e com vírgula, e em %)', formas: unicos(ctrs.flatMap(c => [c, c.replace('.', ','), (Number(c) * 100).toFixed(1).replace('.', ',') + '%'])) },
    { grupo: 'id de vídeo que só existe no relatório', formas: [ORFAO_YT_ID] },
    { grupo: 'dia e id do relatório (ISO)', formas: unicos(e.dias.flatMap(d => [`${d}T07:00:00`, `seed-${pref}-${d}`, d])) },
    { grupo: 'views por dia (mediana do diário)', formas: unicos([`${Math.floor(vpd)}/dia, n = ${e.nVpd}`, `${Math.ceil(vpd)}/dia, n = ${e.nVpd}`, String(vpd), String(vpd).replace('.', ',')]) },
    { grupo: 'views do diário por vídeo (28 dias)', formas: unicos([...viewsPorVideo.values()].filter(n => n > 0).flatMap(formasNum)) },
  ]
}
const ondeEsta = (f: Fonte, s: string): Onde[] => (['html', 'dom', 'rede'] as const).filter(k => f[k].includes(s))
const trecho = (txt: string, s: string): string => { const i = txt.indexOf(s); return txt.slice(Math.max(0, i - 40), i + s.length + 40).replace(/\s+/g, ' ') }
const CAPA = (r: { fulfill: (o: { status: number; contentType: string; body: Buffer }) => Promise<void> }) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG })

/** Abre a tela num contexto, registra as respostas de rede do navegador e devolve o que ele recebeu (ver Fonte). `passeio` navega do canal ao vídeo pelo cliente (carga flight). */
async function coletarTela(ctx: BrowserContext, t: { url: string; espera: string }, passeio = false): Promise<Fonte> {
  const pg = await ctx.newPage()
  try {
    await pg.route(/(ytimg|ggpht)\.com/, CAPA)
    const corpos: Array<Promise<string>> = []
    pg.on('response', r => {
      const tipo = r.request().resourceType(), ct = r.headers()['content-type'] ?? ''
      if (tipo === 'document' || /\/_next\/static\//.test(r.url()) || /^(image|font)\//.test(ct) || /css|javascript/.test(ct)) return
      corpos.push(r.text().catch(() => ''))
    })
    const bruto = await ctx.request.get(t.url)
    expect(bruto.status(), `HTML bruto de ${t.url}`).toBe(200)
    const html = await bruto.text()
    await pg.goto(t.url)
    await pg.locator(t.espera).first().waitFor({ timeout: 40_000 })
    await pg.waitForLoadState('networkidle')
    if (passeio) {
      await pg.locator(`${S}:visible ul.cv-grid > li.cv-card a`).first().click()
      await pg.waitForURL(/\/video\//)
      await pg.locator(`${V} h1:visible`).first().waitFor({ timeout: 40_000 })
      await pg.waitForLoadState('networkidle')
    }
    const dom = (await pg.content()) + '\n' + (await pg.evaluate(() => document.body.innerText + '\n' + (document.body.textContent ?? '').replace(/\s+/g, ' ')))
    const rsc = await (await ctx.request.get(t.url, { headers: { RSC: '1' } })).text()
    const rede = [...(await Promise.all(corpos)), rsc].join('\n')
    expect(rsc.length, `carga RSC de ${t.url} veio vazia: a prova de rede estaria vazia`).toBeGreaterThan(500)
    return { html, dom, rede }
  } finally { await pg.close() }
}

blocoT15('T15 quem só lê o site (usuário "reporter"): nenhum número privado aparece nem vem no HTML', { ownPreset: '2', ownL2: 'grande' }, () => {
  test('SENTINELAS: cada valor do dado privado, em todas as formas, aparece para o admin (controle positivo) e NÃO aparece para o reporter no HTML bruto, no DOM nem em nenhuma resposta de rede, nas 4 telas', async ({ browser, page }) => {
    test.setTimeout(480_000)
    const sb = localServiceClient(), siteId = await getSeedSiteId()
    const p = await lerPrivado(), e = esperado(p)
    expect(e.imp, 'perfil grande: a soma está entre 10 mil e 1 milhão').toBeGreaterThan(10_000)
    expect(e.cliques).not.toBeNull()
    // o vídeo para a 4ª tela: o de mais impressões entre os que existem em youtube_videos
    const melhor = [...e.porVideo.entries()].sort((a, b) => b[1] - a[1]).find(([y]) => p.reach.some(r => r.ytId === y && r.videoId != null))!
    const idVideo = p.reach.find(r => r.ytId === melhor[0])!.videoId!
    const telas: Record<Tela, { url: string; espera: string }> = {
      lista: { url: `${ROTA}?niche=todos`, espera: `[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]` },
      comparação: { url: `${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`, espera: '[data-obs-screen]:visible tr' },
      canal: { url: url('?painel=1'), espera: `${S}:visible section.pn` },
      vídeo: { url: `${ROTA}/video/${idVideo}?from=canais&canal=${PROPRIO()}`, espera: `${V} h1:visible` },
    }
    const nomes = Object.keys(telas) as Tela[]
    const lista = sentinelas(p, e, PROPRIO())
    const todas = unicos(lista.flatMap(s => s.formas))
    medida(`sentinelas: ${lista.length} grupos, ${todas.length} formas`)

    // 1) a LINHA DE BASE: as mesmas 4 telas, como admin, SEM nenhum dado privado. O que aparece aqui é público: uma forma que coincide com o público não prova nada e é descartada.
    const base = {} as Record<Tela, Fonte>
    let admin = {} as Record<Tela, Fonte>
    try {
      await clearOwnL2(siteId, sb)
      for (const n of nomes) base[n] = await coletarTela(page.context(), telas[n])
    } finally { await seedOwnL2(siteId, 'grande', '2', sb) }
    // 2) o admin com o dado: controle positivo
    for (const n of nomes) admin[n] = await coletarTela(page.context(), telas[n], n === 'canal')
    // 3) o reporter
    const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '../../../.auth/reporter.json'), viewport: { width: 1440, height: 900 } })
    const leitor = {} as Record<Tela, Fonte>
    try {
      await ctx.route('**/*', async route => {
        const r = route.request()
        if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
        await route.fallback()
      })
      for (const n of nomes) leitor[n] = await coletarTela(ctx, telas[n], n === 'canal')
    } finally { await ctx.close() }

    // 4) a conta
    const ambigua = (f: string): boolean => nomes.some(n => ondeEsta(base[n], f).length > 0)
    const vazou: string[] = [], linhas: string[] = []
    for (const g of lista) {
      const validas = g.formas.filter(f => !ambigua(f))
      const comControle = validas.filter(f => nomes.some(n => ondeEsta(admin[n], f).length > 0))
      const positivos = unicos(nomes.flatMap(n => comControle.flatMap(f => ondeEsta(admin[n], f).map(o => `${n}/${o}`))))
      const negativas: string[] = []
      for (const f of validas) for (const n of nomes) for (const o of ondeEsta(leitor[n], f)) {
        vazou.push(`SEGURANÇA: "${f}" (${g.grupo}) chegou ao reporter na tela ${n} em ${o}: …${trecho(leitor[n][o], f)}…`)
        negativas.push(`${n}/${o}`)
      }
      linhas.push(`${g.grupo} | formas ${g.formas.length}, públicas descartadas ${g.formas.length - validas.length}, com controle positivo ${comControle.length} | positivo (admin): ${positivos.join(', ') || 'nenhum'} | reporter: ${negativas.length ? 'VAZOU ' + negativas.join(', ') : 'limpo em html, dom e rede, nas 4 telas'}`)
    }
    for (const l of linhas) medida(l)
    // as respostas de rede do reporter foram de fato lidas (uma captura vazia passaria em tudo)
    for (const n of nomes) medida(`tamanhos (${n}): reporter html ${leitor[n].html.length}, dom ${leitor[n].dom.length}, rede ${leitor[n].rede.length}; admin html ${admin[n].html.length}, dom ${admin[n].dom.length}, rede ${admin[n].rede.length}`)
    expect(vazou, 'DEFEITO DE SEGURANÇA: dado privado chegou ao usuário só de leitura').toEqual([])
    // o detector enxerga: cada grupo tem ao menos uma forma não pública que o admin recebe. Exceção medida e fixada: três grupos que o servidor NÃO manda nem ao admin
    // (a tela só recebe os cliques já calculados, a frase "N vídeos com impressões não estão entre os guardados" sem o id, e a mediana sem as views de cada vídeo).
    // Para eles só vale a negativa; se um dia o admin passar a recebê-los, esta lista falha e o grupo ganha controle positivo.
    const semControle = lista.filter(g => !g.formas.some(f => !ambigua(f) && nomes.some(n => ondeEsta(admin[n], f).length > 0))).map(g => g.grupo).sort()
    medida(`grupos sem controle positivo (o admin também não os recebe): ${semControle.join(' ; ') || 'nenhum'}`)
    // A4 (13.3/13.4): "views do diário por vídeo (28 dias)" ganhou controle positivo (a Retenção e os cartões escrevem as views de 28 dias de cada vídeo);
    // o CTR por dia e o id órfão seguem sem tela que os escreva (a taxa de clique agregada e seus extremos têm o controle na prova de `proprio-a4-seguranca.spec.ts`)
    expect(semControle).toEqual(['CTR (fração com ponto e com vírgula, e em %)', 'id de vídeo que só existe no relatório'].sort())
    // o reporter recebeu as telas com as frases de "só quem edita o site vê" no lugar dos números
    expect(leitor['canal'].dom).toContain('Só quem edita o site vê as impressões.')
    expect(leitor['canal'].dom).not.toContain('ic-svg')
  })

  test('o reporter abre a página, a lista, a comparação e o vídeo com as frases de "só quem edita o site vê"', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '../../../.auth/reporter.json'), viewport: { width: 1440, height: 900 } })
    const lei = await ctx.newPage()
    try {
      await lei.route(/(ytimg|ggpht)\.com/, CAPA)
      await lei.goto(url('?painel=1'))
      await lei.locator(`${S}:visible .chead`).first().waitFor()
      const t = await lei.locator(`${S}:visible`).first().innerText()
      expect(t).toContain('só quem edita o site vê este número')
      expect(t).toContain('Só quem edita o site vê as impressões.')
      expect(t).toContain('Só quem edita o site vê os vídeos que mais apareceram.')
      expect(t).toContain('só quem edita o site vê as views por dia do seu canal')
      await expect(lei.locator(`${S}:visible section.pn .ic-vazio`)).toHaveText(['Só quem edita o site vê as impressões.', 'Só quem edita o site vê as views.'])
      await lei.goto(`${ROTA}?niche=todos`)
      await lei.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`).waitFor({ timeout: 40_000 })
      expect(await textoDe(lei.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`))).toMatch(/só quem edita o site vê as views por dia do seu canal/i)
      await lei.goto(`${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`)
      const v = lei.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first()
      await v.waitFor({ timeout: 40_000 })
      await expect(v.locator('td.cA small.why')).toHaveText(/só quem edita o site vê as views por dia do seu canal/i)
      // o vídeo próprio: a nota de alcance também some
      await lei.goto(url('')); await lei.locator(`${S}:visible ul.cv-grid > li.cv-card`).first().waitFor({ timeout: 40_000 })
      const idVideo = await lei.locator(`${S}:visible ul.cv-grid > li.cv-card`).first().getAttribute('data-id')
      await lei.goto(`${ROTA}/video/${idVideo}?from=canais&canal=${PROPRIO()}`)
      await lei.locator(`${V} h1:visible`).first().waitFor({ timeout: 40_000 })
      const tv = await lei.locator(`${V}:visible`).first().innerText()
      expect(tv).not.toMatch(/\d impressões/)
      await lei.screenshot({ path: SHOTS_DADO('leitor-video-1440-escuro') })
      await lei.goto(url('?painel=1')); await lei.locator(`${S}:visible section.pn`).first().waitFor()
      await lei.screenshot({ path: SHOTS_DADO('leitor-canal-1440-escuro') })
    } finally { await ctx.close() }
  })
})

/* ---- números grandes (entre 10 mil e 1 milhão) a 390 px */
blocoT15('T15 números grandes: impressões de cinco algarismos a 390 px não passam da coluna', { ownPreset: '2', ownL2: 'grande' }, () => {
  test('o canal com ~50 mil impressões a 390 px, com a seção aberta e a tabela alternativa aberta: nada rola para o lado, nada passa da coluna, o texto mínimo é 12 px', async ({ page }) => {
    const e = esperado(await lerPrivado())
    expect(e.imp).toBeGreaterThan(10_000)
    expect(e.imp).toBeLessThan(1_000_000)
    await abrirComGrafico(page, { width: 390, height: 844 })
    const imp = tela(page).locator('dl[aria-label="Números do canal"] .nc').filter({ hasText: 'impressões' }).first()
    await expect(imp.locator('dd:not(.nsub)')).toHaveText(abrev(e.imp))
    await tela(page).getByRole('button', { name: /Todos os números/ }).click()
    await expect(grafico(page).locator('.ic-res')).toContainText(`${PT(e.imp)} impressões`)
    const medir = async (quando: string) => {
      const l = await larguras(page)
      medida(`390 px, ${quando}: docScroll ${l.docScroll}, contScroll ${l.contScroll}, fora: ${l.fora.join(' | ') || 'nenhum'}, menor texto ${l.menor}px`)
      expect(l.docScroll, `${quando}: rolagem horizontal do documento`).toBeLessThanOrEqual(0)
      expect(l.contScroll, `${quando}: rolagem horizontal do contêiner`).toBeLessThanOrEqual(0)
      expect(l.fora, `${quando}: elementos fora da coluna`).toEqual([])
      expect(l.menor, `${quando}: ${l.quem}`).toBeGreaterThanOrEqual(12)
      // nenhuma célula, cartão ou legenda esconde texto por estouro
      const estouros = await tela(page).evaluate(raiz => [...raiz.querySelectorAll<HTMLElement>('.nc, dd, li.cv-card, figure.ic, .ic-res, .ic-leg, .ic-eixo')]
        .filter(el => el.getClientRects().length > 0 && !el.closest('.fscroll, .nclip, .cv-tw') && el.scrollWidth > el.clientWidth + 1)
        .map(el => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} ${el.scrollWidth}>${el.clientWidth}`).slice(0, 6))
      expect(estouros, `${quando}: texto maior que a caixa`).toEqual([])
    }
    await medir('seção aberta')
    await grafico(page).locator('details.ic-tab summary').click()
    await medir('tabela alternativa aberta')
    await tela(page).locator('ul.cv-grid').scrollIntoViewIfNeeded()
    const cartoes = await tela(page).locator('ul.cv-grid > li.cv-card').evaluateAll(els => els.map(e => (e.textContent ?? '').replace(/\s+/g, ' ')))
    const maior = [...e.porVideo.values()].sort((a, b) => b - a)[0]!
    medida(`cartões a 390 px com o maior vídeo (${PT(maior)}): ${cartoes.filter(t => /impressões/.test(t)).slice(0, 2).join(' || ').slice(0, 300)}`)
    expect(cartoes.some(t => t.includes(`${PT(maior)} impressões`) || t.includes(`${abrev(maior)} impressões`)), `o cartão do maior vídeo (${PT(maior)}) escreve o número, inteiro ou compacto`).toBe(true)
    await page.screenshot({ path: SHOTS_DADO('canal-grande-390-escuro-cartoes') })
  })
})

/* ---- diário com lacunas: vídeo com menos de 7 linhas e vídeo com impressões e sem diário */
blocoT15('T15 diário com lacunas: o filtro "7 dias ou mais" da mediana e o vídeo com impressões e sem views por dia', { ownPreset: '2', ownL2: 'lacunas' }, () => {
  test('quatro longos têm só 5 dias de diário: ficam fora da mediana (n menor), e a lista, a comparação e o cabeçalho escrevem o mesmo número sem eles', async ({ page }) => {
    const p = await lerPrivado(), e = esperado(p)
    const linhas = new Map<string, number>()
    for (const r of p.diario) linhas.set(r.ytId, (linhas.get(r.ytId) ?? 0) + 1)
    const curtos = [...linhas.values()].filter(n => n < 7).length, comDiario = linhas.size
    expect(curtos, 'o perfil tem vídeos com menos de 7 linhas').toBe(4)
    expect(e.nVpd, 'o filtro n >= 7 tirou exatamente os curtos').toBe(comDiario - curtos)
    // o filtro faz diferença: sem ele a mediana seria outra (as views dos curtos são altas)
    const medias = [...new Map(p.diario.map(r => [r.ytId, 0])).keys()].map(y => { const l = p.diario.filter(r => r.ytId === y); return l.reduce((a, r) => a + r.views, 0) / l.length }).sort((a, b) => a - b)
    const h = medias.length >> 1
    const semFiltro = medias.length % 2 ? medias[h]! : (medias[h - 1]! + medias[h]!) / 2
    expect(semFiltro, 'sem o filtro a mediana seria diferente').not.toBe(e.vpd)
    const ultimo = p.diario.map(r => r.dia).sort().at(-1)!
    const janela = `de ${dm(addDiasStr(ultimo, -27))} a ${dm(ultimo)}`
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ROTA}/comparar?a=${PROPRIO()}&b=${ids.channel('matt-wolfe')}`)
    const linhaVpd = page.locator('[data-obs-screen]:visible tr').filter({ hasText: /^Views por dia nos longos/ }).first()
    await linhaVpd.waitFor({ timeout: 40_000 })
    const num = await textoDe(linhaVpd.locator('td.cA .v1'))
    expect(num).toMatch(NUM_VPD(e.vpd!))
    await expect(linhaVpd.locator('td.cA')).toContainText(`mediana de ${e.nVpd} longos`)
    await page.goto(`${ROTA}?niche=todos`)
    const linha = page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${PROPRIO()}"]`)
    await linha.waitFor({ timeout: 40_000 })
    expect(await textoDe(linha)).toContain(`${num}/dia, n = ${e.nVpd}, ${janela}`)
    medida(`lacunas: ${comDiario} vídeos com diário, ${curtos} com menos de 7 linhas, n da mediana ${e.nVpd}, mediana ${e.vpd!.toFixed(2)} (sem o filtro seria ${semFiltro.toFixed(2)})`)
  })

  test('o vídeo com impressões e SEM nenhuma linha de diário: o cartão traz as impressões, a página dele abre em 200 e nada vira NaN, undefined ou "0 views por dia"', async ({ page }) => {
    const p = await lerPrivado(), e = esperado(p)
    const comDiario = new Set(p.diario.map(r => r.ytId))
    const semDiario = [...e.porVideo.entries()].filter(([y]) => !comDiario.has(y) && p.reach.some(r => r.ytId === y && r.videoId != null))
    expect(semDiario.length, 'o perfil tem vídeo com impressões e sem diário').toBeGreaterThanOrEqual(1)
    const [yt, tot] = semDiario[0]!
    const videoId = p.reach.find(r => r.ytId === yt)!.videoId!
    await abrirComGrafico(page, { width: 1440, height: 900 })
    const cartao = tela(page).locator(`ul.cv-grid > li.cv-card[data-id="${videoId}"]`)
    await expect(cartao).toContainText(`${PT(tot)} impressões`)
    expect(await textoDe(cartao)).not.toMatch(/NaN|undefined|Infinity/)
    const r = await page.goto(`${ROTA}/video/${videoId}?from=canais&canal=${PROPRIO()}`)
    expect(r!.status()).toBe(200)
    await page.locator(`${V} h1:visible`).first().waitFor({ timeout: 40_000 })
    expect(await page.locator(`${V}:visible`).first().innerText()).not.toMatch(/NaN|undefined|Infinity/)
    medida(`vídeo ${yt} (${PT(tot)} impressões) sem linha de diário: cartão e página abrem sem erro`)
  })
})

/* ---- o que ainda espera a Tarefa 14. As quatro que esperavam as telas 13.3 e 13.4 ("Este vídeo no canal", o gráfico do vídeo, os 44 px nos traços da régua e o alvo de toque por dia)
   foram destravadas e reescritas para o desenho aprovado em `proprio-a4-telas.spec.ts` (15b). */
test.describe('T15 pendentes: espera a Tarefa 14 (cartão "Só o seu canal mede" da comparação, que espera a aprovação visual do dono)', () => {
  test.fixme('espera a Tarefa 14: a comparação de um canal seu com um concorrente mostra o cartão "Só o seu canal mede" com quatro linhas: impressões, cliques estimados, taxa com intervalo e % assistido', async () => { /* o cartão ainda não existe: a Tarefa 14 espera a aprovação visual do dono */ })
  test.fixme('espera a Tarefa 14: com dois canais seus o cartão "Só o seu canal mede" mostra os dois lados (dois cartões); sem canal próprio ele não existe', async () => { /* idem */ })
})

test('T15 nenhum POST de server action em nenhuma destas telas (a soma de todos os testes acima)', async () => {
  expect(totalIntrusos, 'POSTs de server action interceptados no arquivo inteiro').toBe(0)
})
