// Decisão 75 · T10 (Gio): "restrito" não é "não medido". Quem só lê o site (reporter) vê o cadeado `.obs-au-restrito` no que é privado do canal próprio
// e NUNCA o número; quem edita (administrador) vê o número e nenhum cadeado. Canal de fora: a frase "Não carregou" deixou de existir.
// "Erro de leitura" e os três estados do "Tentar de novo" não se provocam no servidor pelo e2e (ver plano, T10): ficam nos testes de núcleo e de página.
// Semente: perfil `retencao` do canal próprio (preset 2) + `comentariosC5` (canal de fora). Os esperados vêm do banco local, nunca da tela.
import path from 'node:path'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { C5, localServiceClient } from '../../../fixtures/observatorio-seed'

const REPORTER_STATE = path.resolve(__dirname, '../../../.auth/reporter.json')
const ROTA = '/cms/youtube/competitors'
const SHOTS = process.env.GIO_SHOTS ?? 'test-results/d75'
const CAPA = (r: { fulfill: (o: { status: number; contentType: string; body: Buffer }) => Promise<void> }) =>
  r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') })

let ids: ReturnType<typeof seedIdsOf>
let own: string
let ownVideo: string
let numerosPrivados: string[] = []

test.beforeAll(async () => {
  test.setTimeout(600_000)
  await clearSeeded()
  const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao', comentariosC5: true })
  ids = seedIdsOf(siteId)
  own = ids.own('tnfigueiredo')
  const sb = localServiceClient()
  const v = await sb.from('youtube_videos').select('id, duration_seconds').eq('site_id', siteId).eq('channel_id', own).gt('duration_seconds', 60).limit(1)
  if (v.error || !v.data?.[0]) throw new Error('canal próprio sem vídeo longo na semente: ' + v.error?.message)
  ownVideo = String(v.data[0].id)
  // números privados do banco: impressões somadas (uma forma inequívoca de achar vazamento)
  const r = await sb.from('yt_own_video_reach_daily').select('thumbnail_impressions').eq('site_id', siteId).eq('channel_id', own).limit(5000)
  const total = (r.data ?? []).reduce((a, x) => a + Number(x.thumbnail_impressions ?? 0), 0)
  numerosPrivados = total > 999 ? [String(total), total.toLocaleString('pt-BR')] : []
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

interface Lido { visivel: string; html: string; restritos: number; semNumeroEmRestrito: boolean; scrollX: boolean; alertas: number; retry: number[]; problemas: string[] }
async function ler(ctx: BrowserContext, url: string, espera: string, w = 1440, tema = 'dark'): Promise<Lido> {
  const pg: Page = await ctx.newPage()
  const problemas: string[] = []
  pg.on('pageerror', e => problemas.push('pageerror: ' + e.message))
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problemas.push('console: ' + m.text()) })
  try {
    await pg.route(/(ytimg|ggpht)\.com/, CAPA)
    await ctx.addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    await pg.setViewportSize({ width: w, height: 900 })
    await pg.goto(url)
    await pg.locator(espera).first().waitFor({ timeout: 120_000 })
    await pg.waitForLoadState('networkidle')
    return await pg.evaluate((): Omit<Lido, 'problemas'> => {
      const vis = (e: Element) => { const r = (e as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const restritos = [...document.querySelectorAll('.obs-au-restrito')].filter(vis)
      return {
        visivel: document.body.innerText, html: document.documentElement.outerHTML,
        restritos: restritos.length,
        semNumeroEmRestrito: restritos.every(e => !/\d/.test((e.closest('td,li,dd,p,div') as HTMLElement | null)?.querySelector('.obs-ch-nm') ? 'x' : '')),
        scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        alertas: [...document.querySelectorAll('[role=alert]')].filter(vis).length,
        retry: [...document.querySelectorAll('.obs-au-retry')].filter(vis).map(e => Math.round((e as HTMLElement).getBoundingClientRect().height)),
      }
    }).then(r => ({ ...r, problemas }))
  } finally { await pg.close() }
}

const TELAS_PROPRIAS = [
  { nome: 'canal próprio', url: () => `${ROTA}/canal/${own}?painel=1&nums=1`, espera: '[data-obs-screen] section.pn' },
  { nome: 'vídeo próprio', url: () => `${ROTA}/video/${ownVideo}?from=canais&canal=${own}`, espera: '[data-obs-screen] h1' },
  { nome: 'Comparar', url: () => `${ROTA}/comparar?a=${own}&b=${ids.channel('matt-wolfe')}`, espera: '[data-obs-screen]:visible tr' },
]

test.describe('restrito: reporter vê cadeado e nenhum número; administrador vê números e nenhum cadeado', () => {
  for (const t of TELAS_PROPRIAS) {
    test(`${t.nome}: reporter`, async ({ browser }) => {
      test.setTimeout(240_000)
      const ctx = await browser.newContext({ storageState: REPORTER_STATE })
      try {
        const l = await ler(ctx, t.url(), t.espera)
        expect(l.restritos, `${t.nome}: pastilha restrito presente para o reporter`).toBeGreaterThan(0)
        expect(l.alertas, 'nenhum role=alert nas telas com pastilha').toBe(0)
        for (const n of numerosPrivados) expect(l.html, `número privado "${n}" no HTML do reporter`).not.toContain(n)
        expect(numerosPrivados.length, 'a semente tem impressões somadas > 999 (sem isso a prova de vazamento é vazia)').toBeGreaterThan(0)
        expect(l.problemas.filter(p => !/unique "key" prop/.test(p))).toEqual([])
      } finally { await ctx.close() }
    })
    test(`${t.nome}: administrador`, async ({ browser }) => {
      test.setTimeout(240_000)
      const ctx = await browser.newContext({ storageState: ADMIN_STATE })
      try {
        const l = await ler(ctx, t.url(), t.espera)
        expect(l.restritos, `${t.nome}: administrador não vê cadeado`).toBe(0)
        console.log('CONTROLE', t.nome, 'admin vê alguma soma privada:', numerosPrivados.some(n => l.html.includes(n)))
        expect(l.problemas.filter(p => !/unique "key" prop/.test(p))).toEqual([])
      } finally { await ctx.close() }
    })
  }

  test('lista de Canais (reporter): a linha própria tem restrito; as de concorrente não', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await browser.newContext({ storageState: REPORTER_STATE })
    try {
      const pg = await ctx.newPage()
      await pg.route(/(ytimg|ggpht)\.com/, CAPA)
      await pg.setViewportSize({ width: 1440, height: 900 })
      await pg.goto(ROTA)
      await pg.locator('[data-obs-screen] tr, [data-obs-screen] [role=row]').first().waitFor({ timeout: 120_000 })
      await pg.waitForLoadState('networkidle')
      const r = await pg.evaluate(() => {
        const linhas = [...document.querySelectorAll('[data-obs-screen] tbody tr')].filter(e => (e as HTMLElement).offsetParent !== null)
        return linhas.map(l => ({ restrito: l.querySelectorAll('.obs-au-restrito').length, texto: (l.textContent ?? '').replace(/\s+/g, ' ').slice(0, 60) }))
      })
      expect(r.length, 'a lista tem linhas').toBeGreaterThan(1)
      const comRestrito = r.filter(x => x.restrito > 0)
      expect(comRestrito.length, `linhas com restrito: ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(1)
      expect(comRestrito.length, 'só a(s) própria(s), nunca todas').toBeLessThan(r.length)
      await pg.screenshot({ path: path.join(SHOTS, 'canais-reporter.png') })
    } finally { await ctx.close() }
  })
})

test.describe('canal de fora: nenhuma frase "Não carregou" em texto visível', () => {
  test.use({ storageState: ADMIN_STATE })
  const TELAS = [
    { nome: 'Canais', url: () => ROTA, espera: '[data-obs-screen] tr' },
    { nome: 'canal de fora', url: () => `${ROTA}/canal/${ids.channel(C5.canal)}`, espera: '#criador' },
    { nome: 'Histórico do vídeo', url: () => `${ROTA}/video/${ids.video(C5.video.cheio)}`, espera: '.cd-secao .cd-titulo' },
    { nome: 'Comparar', url: () => `${ROTA}/comparar?a=${ids.channel(C5.canal)}&b=${ids.channel('matt-wolfe')}`, espera: '[data-obs-screen]:visible tr' },
  ]
  for (const t of TELAS) {
    test(`${t.nome}`, async ({ browser }) => {
      test.setTimeout(240_000)
      const ctx = await browser.newContext({ storageState: ADMIN_STATE })
      try {
        const l = await ler(ctx, t.url(), t.espera)
        expect(l.visivel).not.toMatch(/Não carregou/i)
        expect(l.problemas.filter(p => !/unique "key" prop/.test(p))).toEqual([])
      } finally { await ctx.close() }
    })
  }
})

test.describe('390 e 1440: sem rolagem horizontal, alvo do "Tentar de novo" (quando presente) >= 44, pastilhas não estouram', () => {
  for (const w of [390, 1440]) {
    for (const t of TELAS_PROPRIAS) {
      test(`${t.nome} ${w} (reporter)`, async ({ browser }) => {
        test.setTimeout(240_000)
        const ctx = await browser.newContext({ storageState: REPORTER_STATE })
        try {
          const l = await ler(ctx, t.url(), t.espera, w)
          // Comparar a 390 rola por dentro da tabela (contêiner próprio); o que não pode é a PÁGINA rolar
          expect(l.scrollX, `${t.nome} ${w}: rolagem horizontal da página`).toBe(false)
          for (const h of l.retry) expect(h).toBeGreaterThanOrEqual(44)
        } finally { await ctx.close() }
      })
    }
  }
})
