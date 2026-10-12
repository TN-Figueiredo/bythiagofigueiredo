// apps/web/e2e/tests/cms/observatorio/validacao-a3.spec.ts
// Tarefa 13, passo 3 da fase A3: o ROTEIRO de validação logada, de ponta a ponta, em 1440 px no tema escuro (e o roteiro curto a 390 px e no tema
// claro). Não compara DOM com mockup: percorre as telas como o dono, confere o que a seção 4.2 do spec (A3.1 a A3.7) promete, guarda capturas em
// docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a3/ e um diário em test-results/validacao-a3-diario.txt. Nenhuma ação de escrita: todo POST de
// server action é abortado e reprova o teste; console sem erro e nenhuma resposta 5xx em todos.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { localServiceClient, resetViewerPrefs } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const SHOTS = path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a3')
const DIARIO = path.resolve(__dirname, '../../../../test-results/validacao-a3-diario.txt')
const ROTA = '/cms/youtube/competitors'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const S = '[data-obs-screen="canais"]'
const C = '[data-obs-screen="comparar"]'
const SORTS = ['subs', 'vpd', 'active', 'outliers', 'swaps', 'growth'] as const
const FMTS = ['longos', 'shorts', 'todos'] as const
const PROIBIDAS = /\b(NaN|undefined|Infinity|\[object|pack|pacote|dataset|conjunto do site|sentinela|R73|escala √|ranking)\b|null\b/i

let ids: ReturnType<typeof seedIdsOf>
let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
function diario(t: string): void { fs.appendFileSync(DIARIO, t + '\n') }
async function semear(preset: '2' | 'mix' | '1'): Promise<void> {
  ids = seedIdsOf(await ensureSeeded({ ownPreset: preset, canalCompleto: preset === '2' }))
}
// o diário só acumula (um worker reiniciado depois de uma falha não pode apagá-lo); quem roda o spec apaga o arquivo antes
test.beforeAll(() => { fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(path.dirname(DIARIO), { recursive: true }) })
test.beforeEach(async ({ page }) => {
  test.setTimeout(420_000)
  intrusos = []; erros = []; cincoXX = []
  await resetViewerPrefs(await getSeedSiteId())
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
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
test.afterAll(async () => { await resetViewerPrefs(await getSeedSiteId()) })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

const param = (page: Page, k: string) => new URL(page.url()).searchParams.get(k)
const canais = (page: Page) => page.locator(`${S}:visible`).first()
const comparacao = (page: Page) => page.locator(`${C}:visible`).first()
const foto = (page: Page, nome: string, full = false) => page.screenshot({ path: path.join(SHOTS, nome + '.png'), fullPage: full })

async function abrirCanais(page: Page, qs = '', size = { width: 1440, height: 900 }): Promise<void> {
  await page.setViewportSize(size)
  await page.goto(ROTA + qs)
  await page.locator(`${S} .toolbar:visible`).first().waitFor({ timeout: 60_000 })
  await page.locator(`${S} table:visible, ${S} .cards:visible`).first().waitFor({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await expect(page.locator(`${S}:visible [aria-busy="true"]`)).toHaveCount(0, { timeout: 20_000 })
}
async function abrirComparar(page: Page, qs: string, size = { width: 1440, height: 900 }): Promise<void> {
  await page.setViewportSize(size)
  await page.goto(`${ROTA}/comparar${qs}`)
  await comparacao(page).locator('h1').waitFor({ timeout: 60_000 })
  await comparacao(page).locator('table').first().waitFor({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
const textoDaTela = (page: Page, sel: string) => page.locator(`${sel}:visible`).first().innerText()
const semProibidas = (t: string, onde: string) => { const m = t.match(PROIBIDAS); expect(m, `${onde}: texto proibido "${m?.[0]}"`).toBeNull() }

/* ============================================================================================== 1. Canais */
test('1. Canais (A3.1, A3.2): 3 formatos × 6 ordenações × 2 direções × 2 escalas; a frase do bloco, a linha presa, nenhum texto interno', async ({ page }) => {
  await semear('2')
  let n = 0
  for (const fmt of FMTS) for (const sort of SORTS) for (const dir of ['desc', 'asc']) for (const scale of (sort === 'vpd' ? ['abs', 'per-mil'] : ['abs'])) {
    await abrirCanais(page, `?fmt=${fmt}&sort=${sort}&dir=${dir}&scale=${scale}`)
    const tabela = await page.locator(`${S}:visible table tbody tr.row`).count()
    const bloco = (await page.locator(`${S}:visible [data-own-block]`).first().innerText()).replace(/\s+/g, ' ')
    const anuncio = (await page.locator(`${S}:visible [data-k="ord-anuncio"]`).first().textContent())?.trim() ?? ''
    const tudo = await textoDaTela(page, S)
    semProibidas(tudo, `${fmt}/${sort}/${dir}/${scale}`)
    expect(tabela, `${fmt}/${sort}/${dir}: tem linhas`).toBeGreaterThan(5)
    // posição só onde existe (Inscritos e Views/dia): fora delas o bloco diz que não há posição escrita
    const comOrdinal = /\d+º de \d+/.test(bloco)
    if (sort !== 'subs' && sort !== 'vpd') expect(comOrdinal, `${sort}: sem ordinal de posição`).toBe(false)
    diario(`[canais] ${fmt}/${sort}/${dir}/${scale} · linhas ${tabela} · anúncio "${anuncio}" · bloco "${bloco.slice(0, 230)}"`)
    if ((fmt === 'longos' && sort === 'subs' && dir === 'desc') || (fmt === 'todos' && sort === 'vpd' && dir === 'desc' && scale === 'abs') || (fmt === 'shorts' && sort === 'vpd' && dir === 'asc' && scale === 'per-mil')
      || (fmt === 'longos' && sort === 'growth' && dir === 'desc')) await foto(page, `canais-${fmt}-${sort}-${dir}-${scale}`)
    n++
  }
  diario(`[canais] combinações percorridas: ${n}`)
})

test('1b. Canais: cartões, nicho e "Todos", linha presa, busca e "só com problema"', async ({ page }) => {
  await semear('2')
  // cartões nos três formatos
  for (const fmt of FMTS) {
    await abrirCanais(page, `?fmt=${fmt}&layout=cards&sort=subs`)
    expect(await page.locator(`${S}:visible .cards article`).count()).toBeGreaterThan(5)
    await expect(page.locator(`${S}:visible .cards article.you`).first()).toBeVisible()
    semProibidas(await textoDaTela(page, S), `cartões ${fmt}`)
    if (fmt === 'longos') await foto(page, 'canais-cartoes-longos')
  }
  // um nicho e "Todos": a frase diz o conjunto
  await abrirCanais(page, '?fmt=longos&sort=subs&niche=ia')
  const ia = (await page.locator(`${S}:visible [data-own-block]`).first().innerText()).replace(/\s+/g, ' ')
  await foto(page, 'canais-nicho-ia')
  await abrirCanais(page, '?fmt=longos&sort=subs&niche=todos')
  const todos = (await page.locator(`${S}:visible [data-own-block]`).first().innerText()).replace(/\s+/g, ' ')
  diario(`[nicho] IA: "${ia.slice(0, 220)}"`); diario(`[nicho] Todos: "${todos.slice(0, 220)}"`)
  expect(todos).toMatch(/no geral/)
  // linha presa ao rolar
  await abrirCanais(page, '?fmt=longos&sort=subs')
  await page.evaluate(() => { const raiz = document.querySelector('[data-obs-screen="canais"]')!; let p = raiz.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement; if (p) p.scrollTop = 520 })
  await page.waitForTimeout(500)
  const pe = page.locator(`${S}:visible .cn-pin`).first()
  diario(`[linha presa] visível ao rolar: ${await pe.evaluate(e => !e.hasAttribute('hidden') && e.getClientRects().length > 0)} · "${((await pe.textContent()) ?? '').replace(/\s+/g, ' ').trim()}"`)
  await foto(page, 'canais-linha-presa')
  // busca
  await abrirCanais(page, '?fmt=longos&sort=subs')
  const busca = page.locator(`${S}:visible .toolbar input`).first()
  await busca.fill('leo')
  await page.waitForTimeout(500)
  const achados = await page.locator(`${S}:visible tbody tr.row:visible`).count()
  diario(`[busca] "leo": ${achados} linhas visíveis`)
  expect(achados).toBeGreaterThan(0); expect(achados).toBeLessThan(10)
  await foto(page, 'canais-busca')
  await busca.fill('zzzz-nao-existe')
  await page.waitForTimeout(500)
  diario(`[busca] sem resultado: "${(await textoDaTela(page, S)).replace(/\s+/g, ' ').match(/Nenhum[^.]*\./)?.[0] ?? '(sem frase de vazio!)'}"`)
  // só com problema
  await abrirCanais(page, '?fmt=longos&sort=subs')
  const prob = page.locator(`${S}:visible a`).filter({ hasText: /^Ver só canais com problema/ }).first()
  await prob.click()
  await expect.poll(() => param(page, 'filter'), { timeout: 20_000 }).toBe('problemas')
  await expect(page.locator(`${S}:visible [aria-busy="true"]`)).toHaveCount(0, { timeout: 20_000 })
  diario(`[problemas] linhas: ${await page.locator(`${S}:visible tbody tr.row`).count()}`)
  await foto(page, 'canais-so-problemas')
})

/* ============================================================================================== 2. abas da moldura */
test('2. As quatro abas da moldura: o atalho "Meu canal" está presente e abre o menu com os canais próprios', async ({ page }) => {
  await semear('2')
  for (const [nome, rota] of [['Canais', ROTA], ['Mudanças', ROTA + '/mudancas'], ['Outliers', ROTA + '/outliers'], ['Insights', ROTA + '/insights']] as const) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(rota)
    await page.locator('[data-obs-chrome]').first().waitFor({ timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
    const atalho = page.locator('[data-meu-canal] button:visible').first()
    await expect(atalho, `${nome}: atalho`).toBeVisible()
    await atalho.click()
    const menu = page.locator('#flut [role="menu"]').filter({ hasText: 'Meus canais' }).first()
    await expect(menu).toBeVisible()
    const itens = await menu.locator('[role="menuitem"]').count()
    diario(`[aba ${nome}] atalho "${(await atalho.getAttribute('aria-label')) ?? (await atalho.textContent())}" · itens do menu ${itens}`)
    expect(itens).toBeGreaterThanOrEqual(2)
    await foto(page, `aba-${nome.toLowerCase().replace('ç', 'c')}-menu`)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
  }
})

/* ============================================================================================== 3. entradas */
test('3. As entradas: "Comparar" na linha e no cartão, "Comparar com o meu canal" no cabeçalho do concorrente, o atalho na página do canal, no Histórico e na comparação', async ({ page }) => {
  await semear('2')
  const leo = ids.channel('leo-khev'), dono = ids.own('tnfigueiredo')
  await abrirCanais(page, '?fmt=longos&sort=subs')
  const linha = page.locator(`${S}:visible a[data-comparar="${leo}"]`).first()
  await expect(linha).toHaveText('Comparar')
  diario(`[entrada] linha: href ${await linha.getAttribute('href')}`)
  await abrirCanais(page, '?fmt=longos&layout=cards', { width: 390, height: 844 })
  const cartao = page.locator(`${S}:visible .cards a[data-comparar="${leo}"]`).first()
  await expect(cartao).toContainText('Comparar com o meu canal')
  await foto(page, 'entrada-cartao-390')
  // cabeçalho do concorrente
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${ROTA}/canal/${leo}`)
  await page.locator('h1').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  const cab = page.getByRole('link', { name: /Comparar com o meu canal/ }).first()
  await expect(cab).toBeVisible()
  diario(`[entrada] cabeçalho do canal: href ${await cab.getAttribute('href')}`)
  await expect(page.locator('[data-meu-canal] button:visible').first()).toBeVisible()
  await foto(page, 'entrada-pagina-do-canal')
  await cab.click()
  await comparacao(page).locator('table').first().waitFor({ timeout: 60_000 })
  expect(param(page, 'a')).toBe(dono); expect(param(page, 'b')).toBe(leo)
  await expect(page.locator('[data-meu-canal] button:visible').first()).toBeVisible() // o atalho na própria comparação
  // Histórico de um vídeo: o atalho na trilha/moldura
  const vid = ids.video('matt-opus55')
  await page.goto(`${ROTA}/video/${vid}`)
  await page.locator('h1').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-meu-canal] button:visible').first()).toBeVisible()
  await foto(page, 'entrada-historico')
})

/* ============================================================================================== 4. comparação */
async function lerComparacao(page: Page, nome: string): Promise<void> {
  const t = await textoDaTela(page, C)
  semProibidas(t, nome)
  expect(await comparacao(page).locator('table tbody tr').count(), `${nome}: linhas da tabela`).toBeGreaterThan(5)
  const rapida = (await comparacao(page).locator('h2', { hasText: /Leitura rápida/ }).first().locator('xpath=following::*[1]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  const regua = (await t.match(/régua[^\n]*/i)?.[0]) ?? '(sem frase de régua)'
  diario(`[comparar ${nome}] linhas ${await comparacao(page).locator('table tbody tr').count()} · leitura rápida "${rapida.slice(0, 200)}" · ${regua.slice(0, 160)}`)
}
test('4. Comparação: meu canal × mesmo nicho, outro nicho, sem nicho; concorrente × concorrente; inverter; trocar os seletores', async ({ page }) => {
  await semear('2')
  const dono = ids.own('tnfigueiredo'), en = ids.own('tnfigueiredo-en')
  const leo = ids.channel('leo-khev'), nate = ids.channel('nate-herk'), matt = ids.channel('matt-wolfe')
  const pares: Array<[string, string, string]> = [
    ['meu × mesmo nicho', dono, leo], ['meu × outro nicho', dono, nate], ['concorrente × concorrente', matt, leo], ['dois canais próprios', dono, en],
  ]
  for (const [nome, a, b] of pares) {
    await abrirComparar(page, `?a=${a}&b=${b}`)
    await lerComparacao(page, nome)
    await foto(page, 'comparar-' + nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase())
  }
  // inverter
  await abrirComparar(page, `?a=${dono}&b=${leo}`)
  await comparacao(page).getByRole('button', { name: /Inverter lados/ }).click()
  await expect.poll(() => param(page, 'a'), { timeout: 10_000 }).toBe(leo)
  expect(param(page, 'b')).toBe(dono)
  await lerComparacao(page, 'invertido')
  await foto(page, 'comparar-invertido')
  // trocar os dois seletores (sem rede)
  const selA = comparacao(page).locator('.cp-side[data-lado="A"] select'), selB = comparacao(page).locator('.cp-side[data-lado="B"] select')
  await selB.selectOption(nate)
  await expect.poll(() => param(page, 'b'), { timeout: 10_000 }).toBe(nate)
  await selA.selectOption(matt)
  await expect.poll(() => param(page, 'a'), { timeout: 10_000 }).toBe(matt)
  await lerComparacao(page, 'seletores trocados')
  // padrão sem a/b e ids ruins: sem erro
  await abrirComparar(page, '')
  await lerComparacao(page, 'padrão (sem a/b)')
  await abrirComparar(page, '?a=lixo&b=lixo')
  await lerComparacao(page, 'ids ruins')
})
test('4b. Comparação: meu canal × canal sem nicho (preset com cinco canais próprios) e × o canal próprio sem vídeos (preset de dois)', async ({ page }) => {
  await semear('mix')
  const dono = ids.own('tnfigueiredo')
  for (const outro of ['tnfigueiredo-en', 'thiago-na-estrada', 'thiago-testa-ia', 'mochila-leve']) {
    await abrirComparar(page, `?a=${dono}&b=${ids.own(outro)}`)
    const t = await textoDaTela(page, C)
    semProibidas(t, 'mix ' + outro)
    const sub = t.split('\n').find(l => /^Dois canais/.test(l)) ?? '(sem subtítulo)'
    const chips = await comparacao(page).locator('.cp-side').evaluateAll(es => es.map(e => (e.textContent ?? '').replace(/\s+/g, ' ').slice(0, 140)))
    diario(`[comparar mix ${outro}] subtítulo "${sub}" · lados ${JSON.stringify(chips.map(c => c.slice(-90)))}`)
    await foto(page, 'comparar-mix-' + outro)
  }
  // o segundo canal próprio SEM vídeos: nenhum preset do seed o dá, então os vídeos dele saem do banco LOCAL (o seed é refeito no fim: clearSeeded)
  await semear('2')
  const sb = localServiceClient()
  const del = await sb.from('youtube_videos').delete().eq('site_id', await getSeedSiteId()).eq('channel_id', ids.own('tnfigueiredo-en'))
  expect(del.error, 'apagar os vídeos do canal próprio no banco local').toBeNull()
  try {
  await abrirComparar(page, `?a=${ids.own('tnfigueiredo')}&b=${ids.own('tnfigueiredo-en')}`)
  const t2 = await textoDaTela(page, C)
  semProibidas(t2, 'sem vídeos')
  expect(t2).toMatch(/sem vídeos/i)
  diario(`[comparar sem vídeos] "${t2.replace(/\s+/g, ' ').match(/[^.]*sem vídeos[^.]*\./i)?.[0] ?? ''}"`)
  await foto(page, 'comparar-canal-proprio-sem-videos')
  await abrirCanais(page, '?fmt=longos&sort=subs')
  const bloco = (await page.locator(`${S}:visible [data-own-block]`).first().innerText()).replace(/\s+/g, ' ')
  diario(`[canais com um próprio sem vídeos] bloco "${bloco.slice(0, 300)}"`)
  expect(bloco).toMatch(/sem vídeos/i)
  await foto(page, 'canais-proprio-sem-videos')
  await page.locator('[data-meu-canal] button:visible').first().click()
  const menu = page.locator('#flut [role="menu"]').filter({ hasText: 'Meus canais' }).first()
  await expect(menu).toBeVisible()
  diario(`[menu Meu canal com um próprio sem vídeos] "${(await menu.innerText()).replace(/\s+/g, ' ').slice(0, 300)}"`)
  await foto(page, 'menu-meu-canal-proprio-sem-videos')
  } finally { await clearSeeded() }
})

/* ============================================================================================== 5. o que não pode ter mudado */
test('5. O que não pode ter mudado: adicionar canal (abrir e fechar), menu ⋯ da linha, editor de nicho, painel do canal próprio, página do concorrente, Histórico', async ({ page }) => {
  await semear('2')
  await abrirCanais(page, '?fmt=longos&sort=subs')
  await page.locator('[data-obs-chrome] .obs-ch-actions a[title="Adicionar canal"]').first().click()
  await expect.poll(() => param(page, 'add'), { timeout: 20_000 }).not.toBeNull()
  await page.waitForTimeout(800)
  diario(`[adicionar] formulário aberto: ${await page.locator('form:visible input').count()} campos`)
  await foto(page, 'inalterado-adicionar-canal')
  await page.keyboard.press('Escape')
  await abrirCanais(page, '?fmt=longos&sort=subs')
  // menu ⋯ da linha
  const mais = page.locator(`${S}:visible tbody tr.row:not(.you) button[aria-haspopup="menu"], ${S}:visible tbody tr.row:not(.you) button[aria-label*="Mais"]`).first()
  if (await mais.count()) { await mais.click(); await page.waitForTimeout(300); diario(`[menu ⋯ da linha] itens: ${await page.locator('#flut [role="menuitem"]').count()}`); await foto(page, 'inalterado-menu-da-linha'); await page.keyboard.press('Escape') }
  else diario('[menu ⋯ da linha] NÃO ENCONTRADO pelo seletor genérico (conferir à mão)')
  // editor de nicho
  await abrirCanais(page, '?fmt=longos&sort=subs&nicheEditor=1')
  await page.waitForTimeout(500)
  diario(`[editor de nicho] visível: ${(await textoDaTela(page, S)).includes('nicho')}`)
  await foto(page, 'inalterado-editor-de-nicho')
  // painel lateral do canal próprio
  await abrirCanais(page, `?fmt=longos&sort=subs&channel=${ids.own('tnfigueiredo')}`)
  await expect(page.locator(`${S}:visible .cn-drawer`).first()).toBeVisible()
  await foto(page, 'inalterado-painel-do-canal-proprio')
  // página do concorrente e Histórico
  await page.goto(`${ROTA}/canal/${ids.channel('matt-wolfe')}`)
  await page.locator('h1').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  semProibidas(await page.locator('main').first().innerText(), 'página do canal')
  await foto(page, 'inalterado-pagina-do-canal')
  await page.goto(`${ROTA}/video/${ids.video('matt-opus55')}`)
  await page.locator('h1').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await foto(page, 'inalterado-historico')
})

/* ============================================================================================== roteiro curto: 390 px e tema claro */
for (const [nome, size, tema] of [['390 px escuro', { width: 390, height: 844 }, 'dark'], ['1440 px claro', { width: 1440, height: 900 }, 'light'], ['390 px claro', { width: 390, height: 844 }, 'light']] as const) {
  test(`6. roteiro curto: ${nome}`, async ({ page }) => {
    await semear('2')
    await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    const dono = ids.own('tnfigueiredo'), leo = ids.channel('leo-khev')
    const base = nome.replace(/\s/g, '-')
    for (const qs of ['?fmt=longos&sort=subs', '?fmt=todos&sort=vpd', '?fmt=shorts&sort=subs&layout=cards']) {
      await abrirCanais(page, qs, size)
      semProibidas(await textoDaTela(page, S), `canais ${qs} ${nome}`)
      const larg = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!; return [document.documentElement.scrollWidth - innerWidth, r.scrollWidth - r.clientWidth] })
      diario(`[curto ${nome}] canais ${qs}: excesso horizontal html/tela ${larg.join('/')}`)
      if (qs.includes('todos')) await foto(page, `curto-canais-${base}`)
    }
    await abrirComparar(page, `?a=${dono}&b=${leo}`, size)
    await lerComparacao(page, `curto ${nome}`)
    const exc = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    diario(`[curto ${nome}] comparação: excesso horizontal do html ${exc}`)
    await foto(page, `curto-comparar-${base}`, true)
    await page.goto(`${ROTA}/canal/${leo}`)
    await page.locator('h1').first().waitFor({ timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    await foto(page, `curto-pagina-do-canal-${base}`)
  })
}
