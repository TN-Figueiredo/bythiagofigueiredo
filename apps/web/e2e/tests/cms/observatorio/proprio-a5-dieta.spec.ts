// apps/web/e2e/tests/cms/observatorio/proprio-a5-dieta.spec.ts
// A5 · E6 · Tarefa 6: a dieta do diário não muda um número. Para os perfis `cheio`, `parado` e `retencao`, as três telas da A4 (a lista de canais, o canal
// próprio e o vídeo) são lidas com o diário de antes (uma linha por vídeo e dia, zero incluído) e com o diário da dieta (só os dias com atividade,
// a cobertura diz o resto) e o texto que elas mostram tem de ser IGUAL. O relógio é o do oráculo (OBS_NOW_OVERRIDE), então o texto é estável.
// Nada é escrito: toda server action é abortada e reprova o teste.
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { localServiceClient, RET, type OwnL2 } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
test.beforeEach(() => { intrusos = []; erros = []; cincoXX = [] })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

async function armar(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  await ctx.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
}
function vigiar(page: Page): void {
  page.on('console', m => {
    if (m.type() !== 'error') return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    erros.push(m.text().slice(0, 220) + ' @ ' + loc)
  })
  page.on('pageerror', e => erros.push('pageerror: ' + e.message.slice(0, 220)))
  page.on('response', r => { if (r.status() >= 500) cincoXX.push(r.status() + ' ' + r.url().slice(0, 120)) })
}

/** O texto de cada tela, na ordem: lista de canais (a linha do canal próprio), canal próprio, dois vídeos. */
interface Fotografia { lista: string; canal: string; videos: Record<string, string>; diarioLinhas: number; diarioZeros: number; coberturaLinhas: number }

async function esperarTela(page: Page, espera: string): Promise<void> {
  await page.locator(espera).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
}
async function fotografar(page: Page, perfil: OwnL2, dieta: boolean, semCobertura = false): Promise<Fotografia> {
  const siteId = await ensureSeeded({ ownPreset: '2', ownL2: perfil, ownDieta: dieta })
  const ids = seedIdsOf(siteId), own = ids.own('tnfigueiredo')
  const sb = localServiceClient()
  // só o teste de controle: tira a cobertura que a semente acabou de gravar (o teste de controle limpa a semente e a marca no fim)
  if (semCobertura) { const r = await sb.from('yt_own_video_coverage').delete().eq('site_id', siteId).eq('channel_id', own); expect(r.error).toBeNull() }
  const diario = await sb.from('yt_own_video_daily').select('views').eq('site_id', siteId).eq('channel_id', own)
  const cob = await sb.from('yt_own_video_coverage').select('metric_set').eq('site_id', siteId).eq('channel_id', own)
  expect(diario.error).toBeNull(); expect(cob.error).toBeNull()
  const vids = await sb.from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('channel_id', own)
  const uuid = Object.fromEntries((vids.data ?? []).map(x => [String(x.youtube_video_id), String(x.id)]))

  await page.goto(`${ROTA}?niche=todos`)
  const linha = page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${own}"]`)
  await linha.waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  const lista = (await linha.innerText()).replace(/\s+/g, ' ').trim()

  await page.goto(`${ROTA}/canal/${own}?painel=1`)
  await esperarTela(page, '[data-obs-screen="canal"][data-own="1"] .chead h1')
  await page.locator('svg.ic-svg').first().waitFor({ timeout: 60_000 })
  const canal = (await page.locator('[data-obs-screen="canal"][data-own="1"]:visible').first().innerText()).replace(/[ \t]+/g, ' ').trim()

  const videos: Record<string, string> = {}
  for (const yt of [RET.volumeAlto, RET.magro]) {
    await page.goto(`${ROTA}/video/${uuid[yt]}?from=canais&canal=${own}`)
    await esperarTela(page, '[data-obs-screen="video-proprio"] h1:visible')
    videos[yt] = (await page.locator('[data-obs-screen="video-proprio"]:visible').first().innerText()).replace(/[ \t]+/g, ' ').trim()
  }
  const linhas = diario.data ?? []
  return { lista, canal, videos, diarioLinhas: linhas.length, diarioZeros: linhas.filter(r => Number(r.views) === 0).length, coberturaLinhas: (cob.data ?? []).length }
}

for (const perfil of ['cheio', 'parado', 'retencao'] as const) {
  test(`${perfil}: a lista, o canal e o vídeo mostram os mesmos números com o diário de antes e com o da dieta`, async ({ page }) => {
    test.setTimeout(480_000)
    await armar(page.context()); vigiar(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    const antes = await fotografar(page, perfil, false)
    const depois = await fotografar(page, perfil, true)

    // a dieta aconteceu de verdade: o diário perdeu as linhas de zero, a cobertura é a mesma (dois conjuntos por vídeo com diário)
    expect(antes.diarioZeros, 'o diário de antes tem linhas de zero').toBeGreaterThan(0)
    expect(depois.diarioZeros, 'o diário da dieta não tem nenhuma linha de zero').toBe(0)
    expect(depois.diarioLinhas).toBe(antes.diarioLinhas - antes.diarioZeros)
    expect(antes.coberturaLinhas).toBeGreaterThan(0)
    expect(depois.coberturaLinhas).toBe(antes.coberturaLinhas)

    if (process.env.A5_DUMP) {
      const fs = await import('node:fs')
      fs.mkdirSync(process.env.A5_DUMP, { recursive: true })
      fs.writeFileSync(`${process.env.A5_DUMP}/dieta-${perfil}.json`, JSON.stringify({ antes, depois }, null, 1))
    }
    // as telas: texto IGUAL (a lista, o canal, os dois vídeos) e não vazio
    expect(antes.lista.length).toBeGreaterThan(20); expect(antes.canal.length).toBeGreaterThan(200)
    expect(depois.lista).toBe(antes.lista)
    expect(depois.canal).toBe(antes.canal)
    expect(depois.videos).toEqual(antes.videos)
    for (const t of Object.values(antes.videos)) expect(t.length).toBeGreaterThan(200)

    // o perfil parado, com a dieta, continua medindo zero: nunca "coleta parada" nem "não medido" no lugar do zero das views por dia
    if (perfil === 'parado') {
      for (const t of [depois.lista, depois.canal, ...Object.values(depois.videos)]) expect(t).not.toMatch(/coleta (di[aá]ria )?(deste canal )?parou|coleta parada|a coleta parou/i)
      expect(depois.lista).toMatch(/0\/dia, n = \d+/)
      expect(depois.lista).not.toMatch(/não medido|ainda não há coleta diária|menos de 7/i)
    }
    // o número do item 43 (o desenho citava "35"; a semente de hoje dá estes, nos dois estados): a lista mostra a mediana de views por dia dos vídeos
    expect(depois.lista, 'views por dia do canal (item 43)').toContain(perfil === 'retencao' ? '37/dia, n = 10' : '0/dia, n = 29')
  })
}

// Controle: o teste enxerga a diferença. Com o diário da dieta e SEM a cobertura (o estado que o leitor antigo leria), os dias de zero deixam de ser
// zero medido: a mesma comparação do teste de cima TEM de falhar. Sem este controle, "igual" poderia ser igual por as telas não lerem o diário.
test('controle: com o diário da dieta e sem a cobertura os números NÃO são os mesmos (o teste de cima enxerga a diferença)', async ({ page }) => {
  test.setTimeout(300_000)
  await armar(page.context()); vigiar(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  try {
    const antes = await fotografar(page, 'parado', false)
    const semCobertura = await fotografar(page, 'parado', true, true)
    expect(semCobertura.coberturaLinhas, 'a cobertura foi tirada').toBe(0)
    expect(semCobertura.lista).not.toBe(antes.lista)
    expect(semCobertura.lista, 'sem cobertura o zero vira "não medido"').toMatch(/não medido|ainda não há coleta diária|menos de 7/i)
    expect(antes.lista).not.toMatch(/não medido|ainda não há coleta diária|menos de 7/i)
  } finally {
    await clearSeeded()   // limpa a semente E a marca: nenhum teste seguinte herda um estado sem cobertura
  }
})
