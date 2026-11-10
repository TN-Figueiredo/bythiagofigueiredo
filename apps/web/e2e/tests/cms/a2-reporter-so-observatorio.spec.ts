// A2 (MG19), Tarefa 8: o `reporter` (só lê) alcança apenas o Observatório; a leitora (reporter + concessão) vê os números do canal próprio, a reporter não.
// Prova em navegador, logado, no banco local: o menu, a porta do middleware (307) em cada href do menu e nas 29 páginas sem guarda do inventário,
// as páginas do Observatório no estado real de quem não edita, a busca por dinheiro, e o encaminhamento de ação do Next 16 (Next-Action de /cms/contacts
// postado em /cms/youtube/competitors). Cada negativa tem CONTROLE POSITIVO (o editor/administrador recebe, no mesmo desenho).
// Fixtures: e2e-reporter (SEM concessão; proprio-a4-seguranca depende disso) e e2e-leitora (reporter + site_private_viewers), ver global-setup.ts.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { buildCmsSections } from '../../../src/app/cms/(authed)/_shared/cms-sections'
import { clearSeeded, ensureSeeded, seedIdsOf } from './observatorio/fidelity'
import { localServiceClient } from '../../fixtures/observatorio-seed'

const AUTH = path.resolve(__dirname, '../../.auth')
const ESTADO = { admin: path.join(AUTH, 'admin.json'), editor: path.join(AUTH, 'editor.json'), reporter: path.join(AUTH, 'reporter.json'), leitora: path.join(AUTH, 'leitora.json') }
const SHOTS = process.env.A2_E2E_SHOTS ?? path.resolve(__dirname, '../../../test-results/a2-e2e-shots')
const ROTA = '/cms/youtube/competitors'
const UUID = '00000000-0000-4000-8000-000000000001'
const DINHEIRO = /R\$|US\$|receita|RPM|CPM|AdSense/i

// as 29 páginas da seção 3 do inventário (a5-e17-p0/inventario-reporter.md): sem guarda escrita na própria página; só o layout/porta as barra
const PAGINAS_SEM_GUARDA = [
  '/cms', '/cms/analytics/fans', '/cms/blog', '/cms/blog/new', `/cms/blog/${UUID}/edit`,
  '/cms/campaigns', '/cms/campaigns/new', `/cms/campaigns/${UUID}/edit`, `/cms/contacts/${UUID}`, '/cms/links/settings', '/cms/media',
  '/cms/newsletters', '/cms/newsletters/settings', `/cms/newsletters/${UUID}/edit`, `/cms/newsletters/${UUID}/analytics`, '/cms/newsletters/subscribers',
  '/cms/newsletters/preview/confirm/ok', '/cms/newsletters/preview/unsubscribe/ok', '/cms/playlists', '/cms/playlists/new',
  '/cms/settings/instagram', `/cms/social/${UUID}/og`, '/cms/waitlists', `/cms/waitlists/${UUID}`,
  '/cms/youtube/ab-lab', '/cms/youtube/ab-lab/new', '/cms/youtube/ab-lab/library', `/cms/youtube/ab-lab/${UUID}`, '/cms/youtube/content',
]
// o resto que o inventário cita (seção 4, guardadas com `edit`; comentários e vídeos próprios) e a lista de contatos, que o reporter alcançava por `view`
const PAGINAS_EXTRAS = [
  '/cms/contacts', '/cms/youtube', '/cms/youtube/videos', '/cms/youtube/comments', '/cms/youtube/analytics', '/cms/settings', '/cms/subscribers', '/cms/notifications',
  '/cms/up-next', '/cms/schedule', '/cms/video', '/cms/links', '/cms/social', '/cms/pipeline', '/cms/library/research', '/cms/authors', '/cms/courses',
  '/cms/analytics', '/cms/youtube/categories', '/cms/youtubecompetitors', `${ROTA}x`,
]

const sidebarHrefs = async (page: Page): Promise<string[]> =>
  [...new Set(await page.locator('nav[aria-label="CMS Navigation"] a').evaluateAll(as => as.map(a => a.getAttribute('href') ?? '')))]

async function contexto(browser: Browser, quem: keyof typeof ESTADO, largura = 1440, altura = 900): Promise<BrowserContext> {
  return browser.newContext({ storageState: ESTADO[quem], viewport: { width: largura, height: altura }, reducedMotion: 'reduce' })
}

/** Console e rede: erro de console, exceção de página, requisição com 5xx. Cookie banner fora do caminho. */
function vigiar(page: Page): { erros: string[] } {
  const erros: string[] = []
  // a semente aponta capas/avatares para URLs que não existem: o 404 de imagem é da semente, não do produto (a mesma rota que as specs do Observatório stubam)
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)) })
  page.on('pageerror', e => erros.push('pageerror: ' + String(e).slice(0, 300)))
  page.on('response', r => {
    if (r.status() >= 500) erros.push(`rede ${r.status()}: ${r.url()}`)
    else if (r.status() >= 400 && r.request().resourceType() !== 'image') erros.push(`rede ${r.status()} (${r.request().resourceType()}): ${r.url()}`)
  })
  return { erros }
}

const caminhoDe = (url: string): string => new URL(url).pathname

test.describe('A2: reporter só no Observatório (menu, porta, páginas, dinheiro, número privado, Next-Action)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(240_000)
  let siteId = ''
  let own = ''
  let outro = ''
  let video = ''

  test.beforeAll(async () => {
    test.setTimeout(300_000)
    fs.mkdirSync(SHOTS, { recursive: true })
    siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
    const ids = seedIdsOf(siteId)
    own = ids.own('tnfigueiredo')
    outro = ids.channel('matt-wolfe')
    const sb = localServiceClient()
    const v = await sb.from('youtube_videos').select('id').eq('site_id', siteId).eq('channel_id', own).limit(1).maybeSingle()
    video = String(v.data?.id ?? '')
    expect(video, 'a semente tem um vídeo do canal próprio').not.toBe('')
  })
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

  test('premissa: as fixtures são o que o plano diz (reporter sem concessão, leitora com, os dois só `reporter`)', async () => {
    const sb = localServiceClient()
    const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 })
    const id = (e: string) => users?.users.find(u => u.email === e)?.id
    const rep = id('e2e-reporter@test.local'), lei = id('e2e-leitora@test.local')
    expect(rep && lei).toBeTruthy()
    const mem = await sb.from('site_memberships').select('user_id, role').eq('site_id', siteId).in('user_id', [rep!, lei!])
    expect((mem.data ?? []).map(m => m.role).sort()).toEqual(['reporter', 'reporter'])
    const grants = await sb.from('site_private_viewers').select('user_id, revoked_at').eq('site_id', siteId).in('user_id', [rep!, lei!])
    expect(grants.data, 'só a leitora tem concessão, ativa').toEqual([{ user_id: lei, revoked_at: null }])
  })

  test('MENU: reporter e leitora veem só Competitors; o editor vê todos os hrefs de buildCmsSections (controle positivo)', async ({ browser }) => {
    const todos = buildCmsSections().flatMap(s => s.items.map(i => i.href))
    expect(todos.length).toBeGreaterThan(20)
    for (const quem of ['reporter', 'leitora'] as const) {
      const ctx = await contexto(browser, quem)
      const page = await ctx.newPage()
      const { erros } = vigiar(page)
      await page.goto(ROTA)
      await page.locator('nav[aria-label="CMS Navigation"]').waitFor()
      expect(await sidebarHrefs(page), `menu de ${quem}`).toEqual([ROTA])
      // o link de Settings do rodapé também some (minRole editor)
      await expect(page.locator('a[href="/cms/settings"]')).toHaveCount(0)
      expect(erros.filter(e => !/favicon/i.test(e)), `console/rede de ${quem} no menu`).toEqual([])
      if (quem === 'leitora') {
        await page.screenshot({ path: path.join(SHOTS, 'menu-leitora-1440.png') })
        await page.locator('nav[aria-label="CMS Navigation"]').screenshot({ path: path.join(SHOTS, 'menu-leitora-1440-so-o-menu.png') })
      } else {
        await page.screenshot({ path: path.join(SHOTS, 'menu-reporter-1440.png') })
      }
      await ctx.close()
    }
    const ctx = await contexto(browser, 'editor')
    const page = await ctx.newPage()
    await page.goto('/cms')
    await page.locator('nav[aria-label="CMS Navigation"]').waitFor()
    const hrefs = await sidebarHrefs(page)
    for (const h of todos.filter(h => h !== '/cms/subscribers')) expect(hrefs, `o editor vê ${h}`).toContain(h)
    await page.screenshot({ path: path.join(SHOTS, 'menu-editor-1440.png') })
    await ctx.close()
  })

  test('MENU 390 px: captura para o dono; registra os links do chrome que a leitora enxerga (barra de baixo e trilho de abas do YouTube)', async ({ browser }) => {
    const ctx = await contexto(browser, 'leitora', 390, 844)
    const page = await ctx.newPage()
    await page.goto(ROTA)
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined)
    await page.screenshot({ path: path.join(SHOTS, 'menu-leitora-390.png') })
    const links = await page.evaluate(() => [...document.querySelectorAll('nav a[href], [role="tablist"] a[href], header a[href]')]
      .filter(a => { const r = (a as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 })
      .map(a => a.getAttribute('href') ?? ''))
    fs.writeFileSync(path.join(SHOTS, 'chrome-links-leitora-390.txt'), [...new Set(links)].join('\n') + '\n')
    await ctx.close()
  })

  // ACHADO (ver relatorio-e2e.md): a barra de baixo do celular (Home/Schedule/Posts/Analytics/Letters) e a trilha de abas do YouTube mostram links que a porta
  // manda de volta ao Observatório. `test.fail()`: passa enquanto o defeito existe e fica vermelho quando for consertado (então remover o `test.fail()`).
  test('CHROME: todo link visível para a leitora, em 1440 e em 390 px, leva ao Observatório (hoje não: barra de baixo e abas do YouTube)', async ({ browser }) => {
    test.fail(true, 'achado A2-E2E-1: links do chrome fora do Observatório continuam visíveis ao reporter')
    const fora: string[] = []
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      const ctx = await contexto(browser, 'leitora', w, h)
      const page = await ctx.newPage()
      await page.goto(ROTA)
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined)
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/cms"]')]
        .filter(a => { const r = (a as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        .map(a => a.getAttribute('href') ?? ''))
      for (const l of new Set(links)) if (!new URL(l, 'http://x').pathname.startsWith(ROTA) && !/^\/cms\/(logout|login)/.test(l)) fora.push(`${w}px: ${l}`)
      await ctx.close()
    }
    expect(fora, 'links visíveis fora do Observatório').toEqual([])
  })

  test('PORTA: cada href do menu (exceto Competitors) e as 29 páginas do inventário acabam em /cms/youtube/competitors, para reporter e leitora (editor passa)', async ({ browser }) => {
    test.setTimeout(600_000)
    const menu = buildCmsSections().flatMap(s => s.items.map(i => i.href)).filter(h => h !== ROTA)
    const alvos = [...new Set([...menu, '/cms/settings', ...PAGINAS_SEM_GUARDA, ...PAGINAS_EXTRAS])]
    expect(PAGINAS_SEM_GUARDA).toHaveLength(29)
    const falhas: string[] = []
    const amostraNavegador = new Set(['/cms', '/cms/blog', '/cms/contacts/' + UUID, '/cms/youtube/ab-lab', '/cms/media', `${ROTA}x`])
    for (const quem of ['reporter', 'leitora'] as const) {
      const ctx = await contexto(browser, quem)
      const page = await ctx.newPage()
      for (const url of alvos) {
        // saltos crus, sem seguir: nenhum 200 no caminho; o último salto é 307 para o Observatório (um 308 antes dele vem das redireções antigas do next.config, ex. /cms/pipeline → /cms/up-next)
        let atual = url
        const cadeia: string[] = []
        for (let salto = 0; salto < 3; salto++) {
          const r = await ctx.request.get(atual, { maxRedirects: 0, timeout: 60_000 })
          const loc = r.headers()['location'] ?? ''
          cadeia.push(`${r.status()} ${caminhoDe(new URL(atual, 'http://x').href)} → ${loc}`)
          if (r.status() === 307 || r.status() === 200 || !loc) break
          atual = caminhoDe(new URL(loc, 'http://x').href)
        }
        const ultimo = cadeia[cadeia.length - 1]!
        if (!(ultimo.startsWith('307 ') && ultimo.endsWith(`→ ${ROTA}`))) falhas.push(`${quem} ${url}: cadeia ${cadeia.join(' | ')} (esperado terminar em 307 → ${ROTA})`)
        // no navegador acaba na tela do Observatório (amostra de 6 por usuária: cada goto renderiza o Observatório inteiro no `next dev`, ~8 s; as 3 primeiras execuções com goto em todas
        // as ~60 URLs levaram 10 a 14 min e a 3ª estourou o tempo. A cadeia crua acima já prova o 307 em cada URL.)
        if (amostraNavegador.has(url)) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
          if (caminhoDe(page.url()) !== ROTA) falhas.push(`${quem} ${url}: parou em ${page.url()}`)
        }
      }
      await ctx.close()
    }
    expect(falhas, 'páginas que o reporter/leitora alcançou').toEqual([])
    // controle positivo: o editor NÃO é desviado nas mesmas portas (senão a porta fecharia tudo e a prova seria vazia)
    const ctx = await contexto(browser, 'editor')
    for (const url of ['/cms', '/cms/blog', '/cms/campaigns', '/cms/youtube/ab-lab', '/cms/media']) {
      const r = await ctx.request.get(url, { maxRedirects: 0, timeout: 120_000 })
      expect(r.status(), `editor em ${url}`).toBe(200)
    }
    // o editor também entra no Observatório
    expect((await ctx.request.get(ROTA, { maxRedirects: 0, timeout: 120_000 })).status()).toBe(200)
    await ctx.close()
  })

  test('API fora do /cms: /api/links/[id]/stream sem sessão 401, reporter e leitora 403, editor 200 (T6); o x-site-id forjado não muda nada', async ({ browser }) => {
    const sb = localServiceClient()
    const code = `a2e2e${Date.now().toString(36)}`
    const ins = await sb.from('tracked_links').insert({ site_id: siteId, code, destination_url: 'https://example.test/a2-e2e', title: 'a2 e2e' }).select('id').single()
    expect(ins.error, 'semente do link').toBeNull()
    const id = ins.data!.id as string
    try {
      // a rota é um stream (SSE): o request do Playwright espera o corpo acabar; no navegador lê-se só o status e aborta
      const statusDoStream = (page: Page, extra: Record<string, string> = {}) => page.evaluate(async ([u, h]) => {
        const c = new AbortController()
        const t = setTimeout(() => c.abort(), 8_000)
        try { const r = await fetch(u as string, { credentials: 'include', headers: h as Record<string, string>, signal: c.signal }); const st = r.status; c.abort(); return st } catch { return -1 } finally { clearTimeout(t) }
      }, [`/api/links/${id}/stream`, extra] as const)
      const anon = await browser.newContext()
      const pa = await anon.newPage()
      await pa.goto('/cms/login')
      expect(await statusDoStream(pa), 'sem sessão').toBe(401)
      await anon.close()
      for (const [quem, esperado] of [['reporter', 403], ['leitora', 403], ['editor', 200]] as const) {
        const ctx = await contexto(browser, quem)
        const page = await ctx.newPage()
        await page.goto(ROTA)
        // quem edita passa da guarda: o stream abre (200) ou fica aberto sem cabeçalho até o corte de 8 s (-1); recusa (401/403) é imediata
        const confere = (st: number, nome: string) => (esperado === 200 ? expect([200, -1], nome).toContain(st) : expect(st, nome).toBe(esperado))
        confere(await statusDoStream(page), `stream como ${quem}`)
        confere(await statusDoStream(page, { 'x-site-id': '00000000-0000-4000-8000-0000000000ff' }), `stream como ${quem} com x-site-id forjado`)
        await ctx.close()
      }
    } finally { await sb.from('tracked_links').delete().eq('id', id) }
  })

  test('OBSERVATÓRIO: todas as páginas abrem para reporter e leitora no estado real de quem não edita; /saiu e /sugestoes dizem que não há acesso; sem dinheiro', async ({ browser }) => {
    test.setTimeout(420_000)
    const paginas: Array<{ nome: string; url: string }> = [
      { nome: 'canais', url: ROTA }, { nome: 'sugestoes', url: `${ROTA}/sugestoes` }, { nome: 'outliers', url: `${ROTA}/outliers` },
      { nome: 'arquivo', url: `${ROTA}/arquivo` }, { nome: 'comparar', url: `${ROTA}/comparar?a=${own}&b=${outro}` }, { nome: 'insights', url: `${ROTA}/insights` },
      { nome: 'saiu', url: `${ROTA}/saiu` }, { nome: 'mudancas', url: `${ROTA}/mudancas` },
      { nome: 'canal-proprio', url: `${ROTA}/canal/${own}?painel=1&nums=1` }, { nome: 'canal-retencao', url: `${ROTA}/canal/${own}?tab=retencao&nums=1` },
      { nome: 'canal-concorrente', url: `${ROTA}/canal/${outro}` }, { nome: 'video-proprio', url: `${ROTA}/video/${video}?from=canais&canal=${own}` },
    ]
    const relatorio: string[] = []
    const problemas: string[] = []
    // títulos de vídeo do dado semeado que contêm a palavra de dinheiro ("Pão de R$ 12 em Tóquio"): são dado público do YouTube, não valor do site. Saem do texto antes da busca;
    // sobra só o que a tela escreve por conta própria. O que foi retirado fica no relatório.
    const sb = localServiceClient()
    const titulos = new Set<string>()
    for (const [tabela, col] of [['competitor_videos', 'title'], ['youtube_videos', 'title'], ['competitor_video_versions', 'value_text']] as const) {
      const r = await sb.from(tabela).select(col).filter(col, 'imatch', DINHEIRO.source).limit(2000)
      expect(r.error, `ler ${tabela}.${col}`).toBeNull()
      for (const row of (r.data ?? []) as unknown as Array<Record<string, string | null>>) if (row[col]) titulos.add(row[col]!)
    }
    const semTitulos = (t: string): string => [...titulos].sort((a, b) => b.length - a.length).reduce((acc, x) => acc.split(x).join('').split(x.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join(''), t)
    relatorio.push(`títulos semeados com palavra de dinheiro, retirados antes da busca: ${titulos.size}`)
    // linha de base do editor: o aviso do React "Each child in a list should have a unique key" (Lancamentos, em canal/[id]) aparece também para quem edita?
    // Se sim, é anterior à A2 e não é do papel; vai ao relatório como achado menor em vez de derrubar a prova de acesso.
    const ctxBase = await contexto(browser, 'editor')
    const pgBase = await ctxBase.newPage()
    const base = vigiar(pgBase)
    await pgBase.goto(paginas.find(p => p.nome === 'canal-concorrente')!.url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await pgBase.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined)
    const avisoDeChave = (e: string): boolean => /unique "key" prop/.test(e)
    const chaveNoEditor = base.erros.some(avisoDeChave)
    relatorio.push(`linha de base: o EDITOR também recebe o aviso de key do React em canal-concorrente: ${chaveNoEditor}`)
    await ctxBase.close()
    for (const quem of ['reporter', 'leitora'] as const) {
      const ctx = await contexto(browser, quem)
      const page = await ctx.newPage()
      const { erros } = vigiar(page)
      for (const p of paginas) {
        erros.length = 0
        const resp = await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
        await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined)
        const fim = caminhoDe(page.url())
        const texto = semTitulos(await page.evaluate(() => document.body.innerText))
        const html = semTitulos((await page.content()).replace(/<script[\s\S]*?<\/script>/g, ''))
        const boundary = /Something went wrong|Algo deu errado|Application error/i.test(texto)
        const contexto = (fonte: string, nome: string): string[] => [...fonte.matchAll(new RegExp(DINHEIRO, 'gi'))].slice(0, 3).map(m => `${nome}: …${fonte.slice(Math.max(0, m.index! - 60), m.index! + 60).replace(/\s+/g, ' ')}…`)
        const dinheiro = [...contexto(texto, 'texto'), ...contexto(html, 'html')]
        relatorio.push(`${quem} | ${p.nome} | status ${resp?.status()} | fim ${fim} | texto ${texto.length} | dinheiro ${dinheiro.length ? JSON.stringify(dinheiro) : 'nenhum'} | erros ${erros.length}`)
        if (resp?.status() !== 200) problemas.push(`${quem} ${p.nome}: status ${resp?.status()}`)
        if (!fim.startsWith(ROTA)) problemas.push(`${quem} ${p.nome}: foi para ${fim}`)
        if (boundary) problemas.push(`${quem} ${p.nome}: boundary de erro`)
        if (texto.length < 100) problemas.push(`${quem} ${p.nome}: página vazia (${texto.length} caracteres)`)
        if (dinheiro.length) problemas.push(`${quem} ${p.nome}: palavra de dinheiro ${JSON.stringify(dinheiro)}`)
        for (const e of erros.filter(e => !/favicon|Download the React DevTools/i.test(e) && !(chaveNoEditor && avisoDeChave(e)))) problemas.push(`${quem} ${p.nome}: ${e}`)
        if (p.nome === 'saiu') expect(texto, `${quem} /saiu`).toContain('Você não tem acesso a esta fila.')
        if (p.nome === 'sugestoes') expect(texto, `${quem} /sugestoes`).toContain('Você não tem acesso a esta lista.')
        if (quem === 'reporter' && ['canais', 'saiu', 'canal-proprio'].includes(p.nome)) await page.screenshot({ path: path.join(SHOTS, `obs-${quem}-${p.nome}-1440.png`) })
      }
      await ctx.close()
    }
    fs.writeFileSync(path.join(SHOTS, 'observatorio-paginas.txt'), relatorio.join('\n') + '\n')
    expect(problemas, 'problemas nas páginas do Observatório').toEqual([])
    // controle positivo: o editor recebe a lista de sugestões e a fila (o "sem acesso" é de quem não edita, não da página)
    const ctx = await contexto(browser, 'editor')
    const page = await ctx.newPage()
    await page.goto(`${ROTA}/saiu`)
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined)
    expect(await page.evaluate(() => document.body.innerText), 'o editor não recebe a frase de recusa').not.toContain('Você não tem acesso a esta fila.')
    await ctx.close()
  })

  test('NÚMERO DO CANAL PRÓPRIO: a leitora (concessão) vê gráfico, taxa e % assistido; a reporter (sem concessão) vê as frases de "só quem edita"', async ({ browser }) => {
    test.setTimeout(300_000)
    const S = '[data-obs-screen="canal"][data-own="1"]'
    const marcadores = [`${S} figure.ic svg.ic-svg`, `${S} .pn-taxa .tf`]
    const medir = async (quem: keyof typeof ESTADO) => {
      const ctx = await contexto(browser, quem)
      const page = await ctx.newPage()
      await page.goto(`${ROTA}/canal/${own}?painel=1&nums=1`)
      await page.locator(`${S} section.pn`).first().waitFor({ timeout: 60_000 })
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined)
      const cont = await Promise.all(marcadores.map(m => page.locator(m).count()))
      const texto = await page.evaluate(() => document.body.innerText)
      await page.screenshot({ path: path.join(SHOTS, `canal-proprio-${quem}-1440.png`), fullPage: false })
      await page.goto(`${ROTA}/canal/${own}?tab=retencao&nums=1`)
      await page.locator(`${S} .ret`).first().waitFor({ timeout: 60_000 })
      const linhasRet = await page.locator(`${S} table.tb-v tbody tr`).count()
      const textoRet = await page.evaluate(() => document.body.innerText)
      await ctx.close()
      return { cont, texto, linhasRet, textoRet }
    }
    const adm = await medir('admin')
    const lei = await medir('leitora')
    const rep = await medir('reporter')
    // controle positivo: o administrador recebe os desenhos privados
    expect(adm.cont.every(n => n > 0), `administrador recebe ${JSON.stringify(adm.cont)}`).toBe(true)
    expect(adm.linhasRet).toBeGreaterThan(0)
    // a leitora recebe o mesmo desenho
    expect(lei.cont.every(n => n > 0), `leitora recebe ${JSON.stringify(lei.cont)}`).toBe(true)
    expect(lei.linhasRet, 'leitora vê a tabela de % assistido').toBeGreaterThan(0)
    expect(lei.texto).not.toContain('Só quem edita o site vê as impressões.')
    // a reporter sem concessão não
    expect(rep.cont, 'reporter sem concessão não recebe nenhum desenho privado').toEqual([0, 0])
    expect(rep.linhasRet).toBe(0)
    expect(rep.texto).toContain('Só quem edita o site vê as impressões.')
    expect(rep.textoRet).toContain('Só quem edita o site vê o % assistido.')
  })

  test('NEXT-ACTION: POST em /cms/youtube/competitors com o id de uma ação de /cms/contacts, como reporter e leitora, não devolve dado (controle positivo: o administrador recebe o CSV pela rota certa)', async ({ browser }) => {
    test.setTimeout(300_000)
    const sb = localServiceClient()
    const marca = `GIO-A2-${Date.now()}`
    const email = `${marca.toLowerCase()}@test.example`
    const ins = await sb.from('contact_submissions').insert({ site_id: siteId, name: marca, email, message: 'a2 e2e: mensagem de teste', consent_processing: true, consent_processing_text_version: 'v1' })
    expect(ins.error, 'semente do contato').toBeNull()
    try {
      // 1) o administrador abre /cms/contacts (compila a página e grava o manifesto das ações) e acha o marcador na tela
      const adm = await contexto(browser, 'admin')
      const pa = await adm.newPage()
      await pa.goto('/cms/contacts')
      await pa.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => undefined)
      expect(await pa.evaluate(() => document.body.innerText), 'controle positivo: o administrador vê o contato semeado').toContain(marca)
      // 2) o id da ação exportContacts, do manifesto do Next
      const candidatos = ['.next/dev/server/server-reference-manifest.json', '.next/server/server-reference-manifest.json'].map(p => path.resolve(__dirname, '../../..', p))
      const arq = candidatos.find(p => fs.existsSync(p))
      expect(arq, 'manifesto de ações do Next (server-reference-manifest.json) existe depois de compilar /cms/contacts').toBeTruthy()
      const manifesto = JSON.parse(fs.readFileSync(arq!, 'utf8')) as { node?: Record<string, { exportedName?: string; workers?: Record<string, unknown> }> }
      const entradas = Object.entries(manifesto.node ?? {})
      const exporta = entradas.find(([, v]) => v.exportedName === 'exportContacts')
      const idAcao = exporta?.[0]
      expect(idAcao, `id de exportContacts no manifesto (${entradas.length} ações; exportedName presente: ${entradas.some(([, v]) => !!v.exportedName)})`).toBeTruthy()
      // 3) controle positivo: o administrador chama a ação pela página de contatos (rota certa) e recebe o CSV com o marcador
      const certo = await adm.request.post('/cms/contacts', { headers: { 'Next-Action': idAcao!, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/x-component' }, data: '["all","all"]', timeout: 60_000 })
      const corpoCerto = await certo.text()
      expect(corpoCerto, `controle positivo: o administrador recebe o CSV (status ${certo.status()})`).toContain(marca)
      // e também encaminhado a /cms/youtube/competitors (é o que o Next 16 permite): registra o que o administrador recebe
      const encAdmin = await (await adm.request.post(ROTA, { headers: { 'Next-Action': idAcao!, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/x-component' }, data: '["all","all"]', timeout: 60_000 })).text()
      await adm.close()
      const relatorio = [`id=${idAcao}`, `administrador /cms/contacts: ${certo.status()} contém marcador: ${corpoCerto.includes(marca)}`, `administrador encaminhado a ${ROTA}: contém marcador: ${encAdmin.includes(marca)}`]
      // 4) reporter e leitora: nada
      for (const quem of ['reporter', 'leitora'] as const) {
        const ctx = await contexto(browser, quem)
        for (const alvo of [ROTA, `${ROTA}/sugestoes`, '/cms/contacts']) {
          const r = await ctx.request.post(alvo, { headers: { 'Next-Action': idAcao!, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/x-component' }, data: '["all","all"]', maxRedirects: 0, timeout: 60_000 })
          const corpo = await r.text()
          relatorio.push(`${quem} POST ${alvo}: ${r.status()} contém marcador: ${corpo.includes(marca)}, contém e-mail: ${corpo.includes(email)}, ${corpo.length} bytes: ${corpo.replace(/\s+/g, ' ').slice(0, 160)}`)
          expect(corpo.includes(marca) || corpo.includes(email), `DADO DE CONTATO chegou a ${quem} por POST ${alvo} com Next-Action de /cms/contacts`).toBe(false)
        }
        await ctx.close()
      }
      fs.writeFileSync(path.join(SHOTS, 'next-action.txt'), relatorio.join('\n') + '\n')
    } finally {
      await sb.from('contact_submissions').delete().eq('email', email)
    }
  })
})
