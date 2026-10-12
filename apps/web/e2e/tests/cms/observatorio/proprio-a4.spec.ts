// apps/web/e2e/tests/cms/observatorio/proprio-a4.spec.ts
// A prova, no navegador de verdade, da PÁGINA DO CANAL PRÓPRIO da fase A4 (Tarefa 8). O banco local NÃO tem linha nas tabelas privadas
// (yt_own_video_reach_daily e yt_own_video_daily: a semente é a Tarefa 15), então aqui se prova o que dá com a base atual: a página abre, os
// estados SEM dado dizem o motivo, as abas, os links (vídeo, comparação, ?channel=), o Voltar, 390 e 1440 px, o tema claro. Os estados COM
// dado (impressões, cliques, terceira linha) ficam provados em jsdom com a fixture (proprio-tela.test.tsx).
// Semente: oráculo + cinco canais próprios (ownPreset '2'); `mochila-leve` (inserido aqui) é um canal novo, sem vídeo. Nada é escrito no banco: todo POST de
// server action é abortado e reprova o teste. As medidas vão para test-results/proprio-a4-medidas.txt e para as anotações de cada teste.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf } from './fidelity'
import { resetViewerPrefs, localServiceClient, ownSeedUuid } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
const MEDIDAS = path.resolve(__dirname, '../../../../test-results/proprio-a4-medidas.txt')
const SHOTS = path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a4')
test.beforeAll(async () => {
  test.setTimeout(240_000)
  const siteId = await ensureSeeded({ ownPreset: '2' })
  ids = seedIdsOf(siteId)
  // o canal NOVO do dono (sem nenhum vídeo): a semente do oráculo dá vídeos a todos os canais próprios, então ele é inserido aqui, só no banco LOCAL
  // (localServiceClient recusa outro). O id é um dos que o `clearObservatory` apaga, então o teardown o leva junto.
  const sb = localServiceClient()
  const id = ids.own('mochila-leve')
  const ins = await sb.from('youtube_channels').upsert({
    id, site_id: siteId, channel_id: 'UCmochilaleve0000000000', handle: '@mochilaleve', locale: 'pt', slug: 'mochila-leve', name: 'Mochila Leve (novo)', niche: null,
    uploads_playlist_id: 'UUmochilaleve0000000000', subscriber_count: 3, last_synced_at: new Date().toISOString(), created_at: new Date().toISOString(),
  })
  if (ins.error) throw new Error('canal novo: ' + ins.error.message)
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
test.afterEach(() => {
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
    await expect(imp.locator('.obs-ch-nm')).toHaveText('ainda sem relatório de alcance deste canal')
    await expect(imp.locator('dd')).not.toHaveText(/^0$/)
    // cartões: três colunas, a coluna do meio sem número diz "sem relatório" em .obs-ch-nm; a terceira linha não existe sem leitura
    const cartao = tela(page).locator('ul.cv-grid > li.cv-card').first()
    await expect(cartao.locator('.cv-c.nd .obs-ch-nm').first()).toHaveText('sem relatório')
    await expect(cartao.locator('p.cv-n3')).toHaveCount(0)
    await expect(cartao).not.toContainText(/\b0 impress/)
    // a frase das views por dia: UMA vez, na linha das abas
    await expect(tela(page).getByText(/Views por dia de cada vídeo/)).toHaveCount(1)
    await expect(tela(page).locator('nav.ctabs p.res')).toContainText('o desenho delas nesta tela ainda não existe')
    medida(`cartões: ${await tela(page).locator('ul.cv-grid > li.cv-card').count()}`)
  })

  test('as abas Trocas, Leitura e Retenção dizem a frase do spec; o Voltar do navegador desfaz a troca de aba', async ({ page }) => {
    await abrir(page)
    const abas = tela(page).locator('nav.ctabs')
    await expect(abas.locator('li a')).toHaveText([/^Vídeos\s*\d+$/, 'Trocas', 'Leitura', 'Retenção'])
    for (const [nome, frase] of [['Trocas', 'Trocas dos seus vídeos ainda não são lidas nesta tela.'], ['Leitura', 'A leitura da forja para o seu canal ainda não existe.'], ['Retenção', 'Retenção ainda não coletada.']] as const) {
      await abas.getByRole('link', { name: nome }).click()
      await expect(tela(page).locator('.cv-empty p').first()).toHaveText(frase)
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

  test('"Todos os números" abre as onze células e o ⓘ lista a base das 17; as de alcance dizem o motivo', async ({ page }) => {
    await abrir(page)
    await tela(page).getByRole('button', { name: /Todos os números/ }).click()
    await expect(tela(page).locator('#canal-nums2 .nc')).toHaveCount(11)
    expect(query(page).get('nums')).toBe('1')
    await expect(tela(page).locator('#canal-nums2 .nc').filter({ hasText: 'cliques estimados' }).locator('.obs-ch-nm')).toHaveText('ainda sem relatório de alcance deste canal')
    await tela(page).getByRole('button', { name: 'De onde vêm os números do canal' }).click()
    await expect(page.locator('#canal-tip li')).toHaveCount(17)
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
    await expect(corpo.locator('.ic-vazio')).toHaveText(SEM_RELATORIO)
    await expect(corpo.locator('.pn-vazio')).toHaveText('Sem relatório de alcance, não há vídeo para listar.')
    await expect(corpo.getByRole('heading', { level: 3 })).toHaveText(['Vídeos que mais apareceram', 'No nicho', 'O que ainda não é medido'])
    await expect(corpo.locator('dl.pn-nm dt')).toHaveText(['Views por dia de cada vídeo', 'Percentual assistido e retenção', 'Origem do tráfego'])
    await expect(corpo.locator('dl.pn-nm dd').first()).toHaveText('já são coletadas; o desenho delas nesta tela ainda não existe.')
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
    await expect(t.locator('.ibtn')).toHaveCount(1)
    await expect(t.locator('[data-alcance-nota]')).toHaveText(NOTA_SEM_RELATORIO)
    await expect(page.locator('.crumbs li:visible')).toHaveText(['Canais', /.+/, 'Vídeo'])
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('vídeo 3 de ')
    await expect(page.locator('.obs-tr-aside [data-pager-pos]:visible')).toContainText('na ordem da lista: do mais novo ao mais antigo')
    // nenhum número do alcance aparece: o banco local não tem linha nas tabelas privadas
    expect(await t.innerText()).not.toMatch(/impressões? \d|\d+ impressões/)
  })

  test('o ⓘ abre a base dos seis números com a conta feita, e Esc devolve o foco ao botão', async ({ page }) => {
    await abrirPeloCartao(page, 2)
    const b = video(page).locator('.ibtn')
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
    await expect(video(page).locator('[role="status"]')).toContainText('Vídeo 6 de ')
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
      await video(page).locator('.ibtn').click()
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
