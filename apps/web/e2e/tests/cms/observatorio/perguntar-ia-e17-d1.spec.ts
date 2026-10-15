// apps/web/e2e/tests/cms/observatorio/perguntar-ia-e17-d1.spec.ts
// E17 degrau 1 · Tarefa 14 (portão de QA): o botão "Perguntar a uma IA" nas telas do Observatório, em navegador de verdade.
// O que só o navegador prova (o resto é teste de unidade em test/youtube/observatorio/contexto-ia-*):
//  1. desligado (CONTEXTO_IA_RULES.ligado falso, o padrão até o envio da Tarefa 15) = nenhum botão, nenhuma faixa, nenhum diálogo, em nenhuma tela;
//  2. ligado = botão em cada tela, diálogo (foco preso, Esc fecha, foco volta ao botão), cópia de verdade pela área de transferência, "Baixar .md",
//     estado "não deu para copiar", prévia legível a 1440 e a 390, no tema claro e no escuro;
//  3. o pacote copiado traz os mesmos números que a tela (3 amostras por tela: o valor existe na tela E no pacote);
//  4. mensagem crua de `sync_error` (a que humanizeSyncError não reconhece) NUNCA chega ao pacote; a tela a mostra (controle positivo);
//  5. dado privado só para quem pode ver (administrador recebe; reporter, não) e a pergunta digitada nunca chega ao servidor;
//  6. console e rede limpos (nenhum erro de console, nenhuma resposta 4xx/5xx).
//
// O interruptor é uma constante de compilação: este arquivo lê o MESMO valor que o servidor lê. Com `ligado: false` roda só o bloco "desligado";
// com `true`, só o bloco "ligado". Nenhum dos dois é pulado por engano: o outro bloco nem é registrado. Para o portão, quem roda troca a
// constante na árvore de trabalho SEM commitar (plano, Tarefa 14); o commit que liga é o da Tarefa 15.
// A allowance `PERGUNTAR_IA_BOTAO` (allowances.ts) é usada aqui: o texto da tela, sem o botão, é o mesmo texto da tela de antes.
//
// Semente SINTÉTICA (repo público): os canais próprios viram "Canal Sintético N" e os vídeos próprios "Vídeo sintético N". Datas e valores vêm
// do relógio congelado do oráculo (OBS_E2E=1, OBS_NOW_OVERRIDE do playwright.config.ts). O banco local é compartilhado: o teste semeia e limpa.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import { ERRO_DA_COLETA_SEM_DETALHE } from '@/lib/youtube/observatorio/contexto-ia/frases'
import * as F from '@/app/cms/(authed)/youtube/competitors/_chrome/perguntar-ia/frases-do-dialogo'
import { ADMIN_STATE, clearSeeded, ensureSeeded, maskAllowed, normalizeText, seedIdsOf } from './fidelity'
import { PERGUNTAR_IA_BOTAO } from './allowances'
import { localServiceClient } from '../../../fixtures/observatorio-seed'

const LIGADO = CONTEXTO_IA_RULES.ligado
const ROTA = '/cms/youtube/competitors'
const REPORTER_STATE = path.resolve(__dirname, '../../../.auth/reporter.json')
const SHOTS = process.env.PIA_SHOTS_DIR ?? path.resolve(__dirname, '../../../../test-results/pia-shots')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
// uma mensagem que humanizeSyncError NÃO reconhece (sem 404, 403, quotaExceeded, timeout nem aborted): a tela a mostra como está
const CRU = 'SENTINELA-CRUA-7731 upstream connect error: reset reason connection termination'
const PERGUNTA = 'PERGUNTA-SENTINELA-91827: qual canal sobe mais?'
const VP = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } } as const
type Tema = 'dark' | 'light'
type TelaId = 'canais' | 'mudancas' | 'outliers' | 'insights' | 'comparar' | 'canal' | 'canal-proprio' | 'video' | 'video-proprio'

fs.mkdirSync(SHOTS, { recursive: true })

interface Ambiente { siteId: string; urls: Record<TelaId, string>; own: string; leo: string }
let amb: Ambiente | null = null

/** Três valores por tela: cada um tem de existir no texto da tela E no pacote copiado (formas comparadas sem espaço rígido). Lidos da tela em 24/10/2026 (relógio do oráculo). */
const AMOSTRAS: Record<TelaId, readonly string[]> = {
  canais: ['1,12 mi', '341 mil', '+3,3%'],
  mudancas: ['1,5 mil views', '46 → 38 caracteres', 'visto pela 1ª vez há 3 h'],
  outliers: ['6,0×', '3,7×', '9,5 mil'],
  insights: ['1,2×', '0,8×', 'n = 40 vs 132'],
  comparar: ['3,21 mil', '862 mil', '+1,4%'],
  canal: ['862 mil', '636', '3,9%'],
  'canal-proprio': ['3,21 mil', '51.932 impressões', '2.635 cliques'],
  video: ['207,6 mil', '2,5×', 'n = 14'],
  'video-proprio': ['595', '3,2%', '00:27'],
}
const NOME_DA_TELA: Record<TelaId, string> = {
  canais: 'Canais', mudancas: 'Mudanças', outliers: 'Outliers', insights: 'Insights', comparar: 'Comparar',
  canal: 'Canal', 'canal-proprio': 'Canal próprio', video: 'Vídeo', 'video-proprio': 'Vídeo próprio',
}
const TELAS: readonly TelaId[] = ['canais', 'mudancas', 'outliers', 'insights', 'comparar', 'canal', 'canal-proprio', 'video', 'video-proprio']
/** O que só o administrador do site recebe no pacote (impressões e cliques do canal próprio, privados). */
const PRIVADOS = ['51.932 impressões', '2.635 cliques'] as const

const norm = (s: string): string => normalizeText(s.replace(/[  ]/g, ' '))

/* ----------------------------------------------------------------------------------------------- semente */
async function preparar(): Promise<Ambiente> {
  const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
  const ids = seedIdsOf(siteId), sb = localServiceClient()
  const own = ids.own('tnfigueiredo'), mw = ids.channel('matt-wolfe')
  // nada de nome real nas capturas: todo canal próprio e os vídeos dele
  const proprios = await sb.from('youtube_channels').select('id').eq('site_id', siteId)
  expect(proprios.error).toBeNull()
  let n = 0
  for (const c of proprios.data ?? []) {
    n++
    const r = await sb.from('youtube_channels').update({ name: `Canal Sintético${n > 1 ? ' ' + n : ''}`, handle: `@canal-sintetico-${n}`, custom_url: `@canal-sintetico-${n}`, thumbnail_url: null, banner_url: null, description: 'Descrição sintética.' }).eq('id', c.id)
    expect(r.error).toBeNull()
  }
  const vs = await sb.from('youtube_videos').select('id, published_at').eq('site_id', siteId).order('published_at', { ascending: false })
  expect(vs.error).toBeNull()
  let i = 0
  for (const v of vs.data ?? []) {
    i++
    const r = await sb.from('youtube_videos').update({ title: `Vídeo sintético ${i}`, title_translation: null, description: 'Descrição sintética.', description_translation: null, thumbnail_url: null, thumbnail_hq_url: null }).eq('id', v.id)
    expect(r.error).toBeNull()
  }
  // a mensagem crua de coleta num canal acompanhado (o oráculo só tem mensagens que humanizeSyncError reconhece)
  const leo = await sb.from('competitor_channels').select('id').eq('site_id', siteId).eq('channel_name', 'Leo Khev').single()
  expect(leo.error).toBeNull()
  const upd = await sb.from('competitor_channels').update({ sync_status: 'error', sync_error: CRU, sync_error_since: new Date(Date.parse('2026-10-24T15:02:00-03:00') - 2 * 86_400_000).toISOString() }).eq('id', leo.data!.id)
  expect(upd.error).toBeNull()
  const vproprio = await sb.from('youtube_videos').select('id').eq('channel_id', own).order('published_at', { ascending: false }).limit(1)
  expect(vproprio.error).toBeNull()
  const R = ROTA
  return {
    siteId, own, leo: leo.data!.id,
    urls: {
      canais: R, mudancas: `${R}/mudancas`, outliers: `${R}/outliers`, insights: `${R}/insights?niche=viagem`,
      comparar: `${R}/comparar?a=${own}&b=${mw}`, canal: `${R}/canal/${mw}`, 'canal-proprio': `${R}/canal/${own}`,
      video: `${R}/video/${ids.video('matt-opus55')}`, 'video-proprio': `${R}/video/${vproprio.data![0]!.id}`,
    },
  }
}

/* ----------------------------------------------------------------------------------------------- navegador */
interface Vigia { problemas: () => string[] }
/** Erro de console, erro de página e resposta 4xx/5xx viram problema. As capas do YouTube são servidas por uma imagem de 1 pixel (como nas outras specs). */
function vigiar(page: Page): Vigia {
  const p: string[] = []
  page.on('console', m => { if (m.type() === 'error') p.push(`console: ${m.text().slice(0, 200)}`) })
  page.on('pageerror', e => p.push(`pageerror: ${String(e).slice(0, 200)}`))
  page.on('response', r => { if (r.status() >= 400) p.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`) })
  return { problemas: () => p }
}
async function contexto(browser: import('@playwright/test').Browser, o: { estado?: string; vp?: keyof typeof VP; tema?: Tema; semClipboard?: boolean } = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    storageState: o.estado ?? ADMIN_STATE, viewport: VP[o.vp ?? '1440'], colorScheme: o.tema ?? 'dark',
    ...(o.semClipboard ? {} : { permissions: ['clipboard-read', 'clipboard-write'] }),
  })
  await ctx.addCookies([{ name: 'btf_theme', value: o.tema ?? 'dark', url: 'http://localhost:3099' }])
  await ctx.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  return ctx
}
async function irPara(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await expect(page.locator('[data-obs-screen]:visible').first()).toBeVisible({ timeout: 60_000 })
}
const botao = (page: Page) => page.getByRole('button', { name: F.BOTAO })
async function abrirDialogo(page: Page): Promise<void> {
  await botao(page).click()
  await expect(page.getByRole('dialog', { name: F.TITULO })).toBeVisible()
  await expect(page.locator('#pi-copiar')).toBeVisible({ timeout: 60_000 })
}
const lerAreaDeTransferencia = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText())
async function copiar(page: Page): Promise<string> {
  await page.locator('#pi-copiar').click()
  await expect(page.locator('#pi-st')).toContainText(F.COPIADO_NEGRITO)
  return lerAreaDeTransferencia(page)
}
async function textoDaTela(page: Page): Promise<string> {
  return page.locator('[data-obs-screen]:visible').first().evaluate(el => (el as HTMLElement).innerText)
}

/* ----------------------------------------------------------------------------------------------- desligado */
if (!LIGADO) {
  test.describe('E17 d1 · desligado (o estado de produção até a Tarefa 15)', () => {
    test.use({ storageState: ADMIN_STATE })
    test.beforeAll(async () => { test.setTimeout(180_000); amb = await preparar() })
    test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

    for (const tela of TELAS) {
      test(`${tela}: nenhum botão, nenhuma faixa, nenhum diálogo, nenhum texto do botão`, async ({ browser }) => {
        test.setTimeout(120_000)
        const ctx = await contexto(browser), page = await ctx.newPage(), v = vigiar(page)
        await irPara(page, amb!.urls[tela])
        await page.waitForLoadState('networkidle')
        await expect(botao(page)).toHaveCount(0)
        await expect(page.locator('#pi-abre, .pi-faixa, dialog.pi-dlg')).toHaveCount(0)
        const corpo = await page.locator('body').innerText()
        expect(maskAllowed(corpo, [PERGUNTAR_IA_BOTAO]), 'a allowance do botão não tem o que mascarar numa tela desligada').toBe(maskAllowed(corpo, []))
        expect(corpo, 'o texto do botão não existe na tela desligada').not.toContain(F.BOTAO)
        expect(v.problemas(), 'console e rede limpos').toEqual([])
        await ctx.close()
      })
    }
  })
}

/* ----------------------------------------------------------------------------------------------- ligado */
if (LIGADO) {
  test.describe('E17 d1 · ligado', () => {
    test.use({ storageState: ADMIN_STATE })
    test.beforeAll(async () => { test.setTimeout(180_000); amb = await preparar() })
    test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

    for (const tela of TELAS) {
      test(`${tela}: botão, diálogo, foco preso, Esc, cópia, números iguais aos da tela, console e rede limpos`, async ({ browser }) => {
        test.setTimeout(180_000)
        const ctx = await contexto(browser), page = await ctx.newPage(), v = vigiar(page)
        await irPara(page, amb!.urls[tela])
        await expect(botao(page)).toHaveCount(1)
        await expect(botao(page)).toBeVisible()
        const telaTexto = await textoDaTela(page)
        // a allowance: tirado o botão, o texto da tela é a tela de antes (o botão mora fora da raiz de comparação ou é só o seu texto)
        expect(maskAllowed(telaTexto, [PERGUNTAR_IA_BOTAO])).not.toContain(F.BOTAO)

        await abrirDialogo(page)
        const dlg = page.locator('dialog.pi-dlg')
        // foco inicial no título; o resumo diz o nome da tela
        await expect(page.locator('#pi-h')).toBeFocused()
        await expect(page.locator('#pi-res')).toContainText(`Pacote da tela ${NOME_DA_TELA[tela]}`)

        // foco preso: 60 Tab seguidos nunca saem do diálogo e o ciclo fecha; Shift+Tab a partir do início cai no último
        const dentro = () => dlg.evaluate(d => d.contains(document.activeElement))
        const visitados = new Set<string>()
        for (let k = 0; k < 60; k++) {
          await page.keyboard.press('Tab')
          expect(await dentro(), `Tab ${k + 1}: o foco ficou dentro do diálogo`).toBe(true)
          visitados.add(await page.evaluate(() => { const a = document.activeElement as HTMLElement; return (a.id || a.getAttribute('aria-label') || a.className || a.tagName) + '|' + a.textContent?.slice(0, 20) }))
        }
        expect(visitados.size, 'há vários alvos de foco e o ciclo repete').toBeGreaterThan(4)
        expect(visitados.size, 'o ciclo fecha (menos alvos que apertos de Tab)').toBeLessThan(60)
        await page.locator('#pi-h').focus()
        await page.keyboard.press('Shift+Tab')
        expect(await dentro(), 'Shift+Tab do início continua dentro').toBe(true)
        await expect(page.locator('#pi-fechar')).toBeFocused()

        // Esc com o ⓘ aberto fecha só o ⓘ; o segundo Esc fecha o diálogo e o foco volta ao botão
        const caixaI = await page.locator('[data-info="metodo"]').boundingBox()
        expect.soft(caixaI?.width ?? 0, `${tela}: o ⓘ do método tem largura de botão (≥ 16 px)`).toBeGreaterThanOrEqual(16)
        expect.soft(caixaI?.height ?? 0, `${tela}: o ⓘ do método tem altura de botão (≥ 16 px)`).toBeGreaterThanOrEqual(16)
        await page.locator('[data-info="metodo"]').dispatchEvent('click') // o clique de verdade exige caixa visível; o achado acima já cobre isso
        await expect(page.locator('#pi-i-metodo')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.locator('#pi-i-metodo')).toHaveCount(0)
        await expect(dlg).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(dlg).toBeHidden()
        await expect(page.locator('#pi-abre')).toBeFocused()

        // reabre (o pacote é pedido de novo), digita a pergunta e copia
        await abrirDialogo(page)
        await page.locator('#pi-q').fill(PERGUNTA)
        await expect(page.locator('.pi-pc')).toContainText(F.contador(PERGUNTA.length, CONTEXTO_IA_RULES.perguntaMax))
        const pacote = await copiar(page)
        await expect(page.locator('#pi-copiar')).toHaveText(F.COPIAR_DE_NOVO)
        await expect(dlg).toBeVisible()

        // o texto copiado: as nove partes na ordem, a pergunta no fim, nada de valor quebrado
        const partes = ['## 2. ', '## 3. ', '## 4. ', '## 5. ', '## 6. ', '## 7. ', '## 8. ', '## 9. ']
        let pos = -1
        for (const p of partes) { const i = pacote.indexOf('\n' + p); expect(i, `parte ${p}na ordem`).toBeGreaterThan(pos); pos = i }
        expect(pacote.startsWith('# Observatório · tela ')).toBe(true)
        expect(pacote.slice(pacote.indexOf('\n## 9. '))).toContain(PERGUNTA)
        expect(pacote).not.toMatch(/\b(undefined|NaN|\[object Object\])\b/)
        expect(pacote).not.toMatch(/\/cms\/|eyJ[A-Za-z0-9_-]{10,}|Bearer |apikey|service_role|SENTINELA-CRUA/)

        // os mesmos números da tela: cada amostra existe na tela e no pacote
        const pacoteN = norm(pacote), telaN = norm(telaTexto)
        for (const a of AMOSTRAS[tela]) {
          expect(telaN, `amostra "${a}" existe na tela ${tela}`).toContain(norm(a))
          expect(pacoteN, `amostra "${a}" da tela ${tela} existe no pacote`).toContain(norm(a))
        }
        // o tamanho dito no diálogo é o do texto copiado (a contagem é de caracteres, não de bytes)
        const dito = (await page.locator('.pi-tam b.num').first().innerText()).replace(/\./g, '')
        expect(Number(dito), 'o número do diálogo é o tamanho real da cópia').toBe(pacote.length)

        await page.screenshot({ path: path.join(SHOTS, `${tela}-1440-dark-dialogo.png`) })
        expect(v.problemas(), 'console e rede limpos').toEqual([])
        await ctx.close()
      })
    }

    test('a pergunta digitada nunca chega ao banco; cada abertura grava uma linha do botão sem ela', async ({ browser }) => {
      test.setTimeout(180_000)
      const sb = localServiceClient()
      const antes = await sb.from('obs_ai_access_log').select('id', { count: 'exact', head: true }).eq('site_id', amb!.siteId).eq('action', 'pacote:comparar')
      expect(antes.error).toBeNull()
      const ctx = await contexto(browser), page = await ctx.newPage()
      await irPara(page, amb!.urls.comparar)
      await abrirDialogo(page)
      await page.locator('#pi-q').fill(PERGUNTA)
      await copiar(page)
      await ctx.close()
      const depois = await sb.from('obs_ai_access_log').select('id, origin, action, result, included_private, output_chars, params', { count: 'exact' }).eq('site_id', amb!.siteId).eq('action', 'pacote:comparar').order('id', { ascending: false }).limit(5)
      expect(depois.error).toBeNull()
      expect(depois.count! - (antes.count ?? 0), 'uma abertura = uma linha').toBe(1)
      const l = depois.data![0]!
      expect(l.origin).toBe('botao')
      expect(l.result).toBe('ok')
      expect(l.included_private, 'o administrador recebeu o privado de Comparar').toBe(true)
      expect(l.output_chars).toBeGreaterThan(1000)
      const todas = await sb.from('obs_ai_access_log').select('*').eq('site_id', amb!.siteId)
      expect(JSON.stringify(todas.data), 'a pergunta não está em nenhuma coluna de nenhuma linha').not.toContain('PERGUNTA-SENTINELA')
    })

    test('sync_error cru: a tela mostra (controle positivo), o pacote de TODA tela traz só a frase fixa', async ({ browser }) => {
      test.setTimeout(400_000)
      const ctx = await contexto(browser), page = await ctx.newPage(), v = vigiar(page)
      const ondeATelaMostra: string[] = [], ondeOPacoteTemAFrase: string[] = []
      const urls: Record<string, string> = { ...amb!.urls, 'canal-leo': `${ROTA}/canal/${amb!.leo}`, 'comparar-leo': `${ROTA}/comparar?a=${amb!.own}&b=${amb!.leo}` }
      for (const [nome, url] of Object.entries(urls)) {
        await irPara(page, url)
        const tela = await textoDaTela(page)
        if (tela.includes('SENTINELA-CRUA-7731')) ondeATelaMostra.push(nome)
        await abrirDialogo(page)
        const pacote = await copiar(page)
        expect(pacote, `o pacote de ${nome} não traz a mensagem crua`).not.toContain('SENTINELA-CRUA-7731')
        expect(pacote, `o pacote de ${nome} não traz pedaço da mensagem crua`).not.toMatch(/upstream connect error|connection termination/)
        if (pacote.includes(ERRO_DA_COLETA_SEM_DETALHE)) ondeOPacoteTemAFrase.push(nome)
        await page.keyboard.press('Escape')
      }
      test.info().annotations.push({ type: 'sync_error cru', description: `a tela mostra em: ${ondeATelaMostra.join(', ')}; o pacote diz a frase fixa em: ${ondeOPacoteTemAFrase.join(', ')}` })
      expect(ondeATelaMostra.length, 'controle positivo: a tela mostra a mensagem crua em ao menos duas telas (senão a prova é vazia)').toBeGreaterThanOrEqual(2)
      for (const n of ondeATelaMostra) expect(ondeOPacoteTemAFrase, `onde a tela mostra a mensagem crua, o pacote diz a frase fixa (${n})`).toContain(n)
      expect(v.problemas(), 'console e rede limpos').toEqual([])
      await ctx.close()
    })

    test('canal próprio: o administrador recebe o dado privado; o reporter não recebe nenhum número privado, nem o texto o menciona como incluído', async ({ browser }) => {
      test.setTimeout(300_000)
      const admin = await contexto(browser), leitor = await contexto(browser, { estado: REPORTER_STATE })
      const pa = await admin.newPage(), pl = await leitor.newPage(), vl = vigiar(pl)
      const nomes: TelaId[] = ['canal-proprio', 'canais', 'comparar']
      for (const tela of nomes) {
        await irPara(pa, amb!.urls[tela])
        await abrirDialogo(pa)
        const doAdmin = await copiar(pa)
        await expect(pa.locator('#pi-res')).toContainText(F.PRIVADO_INCLUIDO)
        if (tela === 'canal-proprio') for (const p of PRIVADOS) expect(norm(doAdmin), `controle positivo: o administrador recebe "${p}" em ${tela}`).toContain(norm(p))
        expect(doAdmin, `o administrador recebe o privado marcado em ${tela}`).toMatch(/privado do canal/)
        await pa.keyboard.press('Escape')

        await irPara(pl, amb!.urls[tela])
        await abrirDialogo(pl)
        const doLeitor = await copiar(pl)
        await expect(pl.locator('#pi-res')).toContainText(F.PRIVADO_EXCLUIDO)
        await expect(pl.locator('#pi-res')).not.toContainText(F.PRIVADO_INCLUIDO)
        for (const p of PRIVADOS) expect(norm(doLeitor), `o reporter não recebe "${p}" em ${tela}`).not.toContain(norm(p))
        expect(doLeitor, `o reporter não recebe tabela privada em ${tela}`).not.toMatch(/\(privado do canal\)/)
        expect(doLeitor, `o texto diz que o privado ficou de fora em ${tela}`).toMatch(/Dado privado do canal: (não incluído|NÃO incluído)|sem o direito|NÃO incluído/)
        await pl.keyboard.press('Escape')
      }
      // o registro: o do administrador diz que incluiu privado, o do reporter diz que não
      const sb = localServiceClient()
      const reg = await sb.from('obs_ai_access_log').select('user_id, included_private, params').eq('site_id', amb!.siteId).eq('action', 'pacote:canal-proprio').order('id', { ascending: false }).limit(2)
      expect(reg.error).toBeNull()
      const flags = (reg.data ?? []).map(r => r.included_private).sort()
      expect(flags, 'uma linha com privado (admin) e uma sem (reporter)').toEqual([false, true])
      expect(vl.problemas(), 'console e rede limpos no reporter').toEqual([])
      await admin.close(); await leitor.close()
    })

    test('"Baixar .md" entrega o arquivo com o texto da cópia; sem a área de transferência o estado "não deu para copiar" aparece e o botão principal vira "Baixar"', async ({ browser }) => {
      test.setTimeout(180_000)
      const ctx = await contexto(browser, { semClipboard: true })
      const page = await ctx.newPage(), v = vigiar(page)
      // a API que o navegador oferece, negada: é o que acontece num navegador que bloqueia a área de transferência
      await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('negado', 'NotAllowedError')), readText: () => Promise.reject(new Error('negado')) } }) })
      await irPara(page, amb!.urls.outliers)
      await abrirDialogo(page)
      await page.locator('#pi-copiar').click()
      await expect(page.locator('#pi-st')).toContainText(F.FALHOU_NEGRITO)
      await expect(page.locator('#pi-st')).toHaveAttribute('role', 'alert')
      await expect(page.locator('#pi-baixar')).toBeVisible()
      await expect(page.locator('#pi-sel')).toHaveText(F.SELECIONAR_PREVIA)
      await expect(page.locator('#pi-copiar')).toHaveText(F.TENTAR_COPIAR_DE_NOVO)
      const [down] = await Promise.all([page.waitForEvent('download'), page.locator('#pi-baixar').click()])
      expect(down.suggestedFilename()).toMatch(/^pacote-outliers-2026-10-24\.md$/)
      const arq = fs.readFileSync((await down.path())!, 'utf8')
      expect(arq.startsWith('# Observatório · tela Outliers')).toBe(true)
      expect(arq.length).toBeGreaterThan(1000)
      // "Selecionar o texto da prévia" seleciona o conteúdo da região
      await page.locator('#pi-sel').click()
      expect(await page.evaluate(() => window.getSelection()?.toString().length ?? 0)).toBeGreaterThan(200)
      expect(v.problemas().filter(p => !/negado/.test(p)), 'console e rede limpos').toEqual([])
      await ctx.close()
    })

    test('erro do servidor: o diálogo diz que não foi montado, a pergunta fica e "Tentar de novo" monta', async ({ browser }) => {
      test.setTimeout(180_000)
      const ctx = await contexto(browser), page = await ctx.newPage()
      await irPara(page, amb!.urls.mudancas)
      let falhou = false
      // a ação do servidor é um POST à própria página com o cabeçalho Next-Action: a primeira resposta é derrubada, as seguintes passam
      await page.route(/\/cms\/youtube\/competitors\/mudancas/, async r => {
        const req = r.request()
        if (!falhou && req.method() === 'POST' && req.headers()['next-action']) { falhou = true; await r.abort('failed'); return }
        await r.continue()
      })
      await botao(page).click()
      await expect(page.locator('#pi-retry')).toBeVisible({ timeout: 60_000 })
      expect(falhou, 'a primeira chamada da ação foi derrubada').toBe(true)
      await expect(page.locator('.pi-err')).toContainText(F.ERRO_TITULO)
      await page.locator('#pi-q').fill(PERGUNTA)
      await page.locator('#pi-retry').click()
      await expect(page.locator('#pi-copiar')).toBeVisible({ timeout: 60_000 })
      await expect(page.locator('#pi-q')).toHaveValue(PERGUNTA)
      await ctx.close()
    })

    /* ---- 1440 e 390, claro e escuro: a prévia é legível, nada vaza da tela, os botões cabem ---- */
    for (const vp of ['1440', '390'] as const) for (const tema of ['dark', 'light'] as const) {
      test(`layout do diálogo · ${vp} · ${tema}: dentro da tela, sem rolagem lateral, prévia legível, ações visíveis`, async ({ browser }) => {
        test.setTimeout(400_000)
        const ctx = await contexto(browser, { vp, tema }), page = await ctx.newPage(), v = vigiar(page)
        const medidas: string[] = []
        for (const tela of TELAS) {
          await irPara(page, amb!.urls[tela])
          // o botão cabe na largura e é alcançável
          const b = await botao(page).boundingBox()
          expect(b, `${tela}: o botão tem caixa`).not.toBeNull()
          expect(b!.x, `${tela}: o botão não sai pela esquerda`).toBeGreaterThanOrEqual(0)
          expect(b!.x + b!.width, `${tela}: o botão não sai pela direita`).toBeLessThanOrEqual(VP[vp].width + 0.5)
          await abrirDialogo(page)
          const m = await page.evaluate(() => {
            const rgba = (c: string): [number, number, number, number] => {
              const cv = document.createElement('canvas'); cv.width = cv.height = 1
              const x = cv.getContext('2d', { willReadFrequently: true })!
              x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1)
              const d = x.getImageData(0, 0, 1, 1).data
              return [d[0]!, d[1]!, d[2]!, d[3]! / 255]
            }
            const fundoDe = (el: Element): [number, number, number] => {
              const pilha: Array<[number, number, number, number]> = []
              for (let e: Element | null = el; e; e = e.parentElement) pilha.push(rgba(getComputedStyle(e).backgroundColor))
              let base: [number, number, number] = [255, 255, 255]
              for (const [r, g, bl, a] of pilha.reverse()) base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), bl * a + base[2] * (1 - a)]
              return base
            }
            const lum = ([r, g, bl]: number[]): number => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(bl!) }
            const contraste = (el: Element): number => {
              const cor = rgba(getComputedStyle(el).color), fu = fundoDe(el)
              const fg: number[] = [cor[0] * cor[3] + fu[0] * (1 - cor[3]), cor[1] * cor[3] + fu[1] * (1 - cor[3]), cor[2] * cor[3] + fu[2] * (1 - cor[3])]
              const a = lum(fg), c = lum(fu)
              return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)
            }
            const d = document.querySelector('dialog.pi-dlg') as HTMLElement, r = d.getBoundingClientRect()
            const pre = document.querySelector('#pi-pre') as HTMLElement, pr = pre.getBoundingClientRect()
            const linha = document.querySelector('#pi-pre .pi-l:not(.h):not(.h1):not(.h3)') as HTMLElement
            const acao = (id: string) => { const e = document.querySelector(id) as HTMLElement | null; if (!e) return null; const q = e.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(e).lineHeight) || 16; const sp = e.querySelector('span'); return { x: q.x, y: q.y, w: q.width, h: q.height, rl: q.right, bt: q.bottom, linhas: sp ? Math.round(sp.getBoundingClientRect().height / lh) : 1 } }
            const ico = document.querySelector('#pi-copiar svg')?.getBoundingClientRect()
            const preenchidos = [...document.querySelectorAll('dialog.pi-dlg svg.i')].filter(e => getComputedStyle(e).fill !== 'none').length
            return {
              vw: innerWidth, vh: innerHeight, dlg: { x: r.x, y: r.y, rl: r.right, bt: r.bottom }, docScroll: document.documentElement.scrollWidth - innerWidth, dlgScroll: d.scrollWidth - d.clientWidth,
              pre: { w: pr.width, h: pr.height, fonte: parseFloat(getComputedStyle(pre).fontSize), contraste: contraste(linha), sobraX: pre.scrollWidth - pre.clientWidth },
              copiar: acao('#pi-copiar'), baixar: acao('#pi-baixar'), fechar: acao('#pi-fechar'), icone: ico ? Math.round(ico.width) : null,
              preenchidos,
              rodapeContraste: contraste(document.querySelector('.pi-aviso b') as Element),
            }
          })
          medidas.push(`${tela}: ${JSON.stringify(m)}`)
          expect.soft(m.dlg.x, `${tela}: diálogo dentro da tela (esquerda)`).toBeGreaterThanOrEqual(-0.5)
          expect.soft(m.dlg.rl, `${tela}: diálogo dentro da tela (direita)`).toBeLessThanOrEqual(m.vw + 0.5)
          expect.soft(m.dlg.y, `${tela}: diálogo dentro da tela (topo)`).toBeGreaterThanOrEqual(-0.5)
          expect.soft(m.dlg.bt, `${tela}: diálogo dentro da tela (base)`).toBeLessThanOrEqual(m.vh + 0.5)
          expect.soft(m.docScroll, `${tela}: sem rolagem lateral da página`).toBeLessThanOrEqual(0)
          expect.soft(m.dlgScroll, `${tela}: sem rolagem lateral do diálogo`).toBeLessThanOrEqual(1)
          expect.soft(m.pre.fonte, `${tela}: a prévia não é minúscula`).toBeGreaterThanOrEqual(11)
          expect.soft(m.pre.contraste, `${tela}: texto da prévia com contraste de leitura (≥ 4,5)`).toBeGreaterThanOrEqual(4.5)
          expect.soft(m.rodapeContraste, `${tela}: aviso fixo com contraste de leitura (≥ 4,5)`).toBeGreaterThanOrEqual(4.5)
          expect.soft(m.pre.w, `${tela}: a prévia tem largura útil`).toBeGreaterThanOrEqual(vp === '1440' ? 400 : 250)
          for (const k of ['copiar', 'baixar', 'fechar'] as const) {
            const a = m[k]!
            expect.soft(a, `${tela}: a ação ${k} existe`).not.toBeNull()
            expect.soft(a.x, `${tela}: ${k} dentro da tela`).toBeGreaterThanOrEqual(-0.5)
            expect.soft(a.rl, `${tela}: ${k} dentro da tela`).toBeLessThanOrEqual(m.vw + 0.5)
            expect.soft(a.bt, `${tela}: ${k} visível sem rolar a página`).toBeLessThanOrEqual(m.vh + 0.5)
          }
          // o rótulo de "Copiar texto" cabe em uma linha: um botão de ação com o texto em três linhas e ícone de 32 px não é um botão
          expect.soft(m.copiar!.linhas, `${tela}: "Copiar texto" em no máximo duas linhas`).toBeLessThanOrEqual(2)
          expect.soft(m.preenchidos, `${tela}: os ícones são de traço (fill none); preenchidos aparecem como bloco preto`).toBe(0)
          expect.soft(m.icone ?? 16, `${tela}: o ícone de "Copiar" tem tamanho de ícone (≤ 24 px)`).toBeLessThanOrEqual(24)
          if (tela === 'canais' || tela === 'canal-proprio') await page.screenshot({ path: path.join(SHOTS, `${tela}-${vp}-${tema}.png`) })
          await page.keyboard.press('Escape')
        }
        fs.writeFileSync(path.join(SHOTS, `medidas-${vp}-${tema}.txt`), medidas.join('\n') + '\n')
        expect(v.problemas(), 'console e rede limpos').toEqual([])
        await ctx.close()
      })
    }

    /* ---- ACHADO G-1 (Gio, 15/10): o "Resumo por imagem" da tela do vídeo (≈ 14 mil de média da imagem A) não está no pacote ---- */
    test('vídeo: o Resumo por imagem da tela (média e tempo no ar por imagem) está no pacote', async ({ browser }) => {
      test.fail(true, 'ACHADO G-1 (portão N3, 15/10): a seção "Resumo por imagem" da tela do vídeo tem números agregados por imagem (≈ 11,4 d no ar, ≈ 14 mil/dia na imagem A) que o pacote não traz; só traz cada passagem. Vira vermelho quando consertar: trocar por test().')
      test.setTimeout(180_000)
      const ctx = await contexto(browser), page = await ctx.newPage()
      await irPara(page, amb!.urls.video)
      const telaN = norm(await textoDaTela(page))
      expect(telaN, 'a tela mostra o resumo por imagem').toContain('Resumo por imagem')
      await abrirDialogo(page)
      const pacoteN = norm(await copiar(page))
      for (const a of ['≈ 11,4 d', '≈ 14 mil']) expect(pacoteN, `o pacote traz "${a}" da tela`).toContain(norm(a))
      await ctx.close()
    })
  })
}
