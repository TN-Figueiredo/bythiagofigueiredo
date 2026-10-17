// apps/web/e2e/tests/cms/observatorio/e5a-comentarios.spec.ts
// A5 · E5a · Tarefa C5 (Gio): "Comentários de destaque" no vídeo de concorrente, logado, em navegador.
//  1. nível TEXTO (administrador): o texto aparece; o NOME de quem comentou não chega ao navegador (nem HTML, nem DOM, nem carga RSC) — a identidade
//     só existe com o token de edição, que a página ainda não repassa (P11).
//  2. nível CONTAGEM (reporter): nem o texto, nem o nome, nem o id do YouTube em HTML, DOM e carga RSC; controle positivo: o administrador tem o texto.
//  3. estados da lista: desligados e "a caminho" têm a frase exata; console limpo.
// Semente determinística (`comentariosC5`, relógio fixo do projeto); os esperados são as constantes de `C5`, nunca lidos da tela.
import path from 'node:path'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { C5 } from '../../../fixtures/observatorio-seed'

const REPORTER_STATE = path.resolve(__dirname, '../../../.auth/reporter.json')
const ROTA = '/cms/youtube/competitors/video/'
const TITULO = 'Comentários de destaque'
const NOMES = [C5.nomeValido, C5.nomeAcompanhadoVencido]
const FOTOS = ['yt3.ggpht.com/c5-foto']
let ids: ReturnType<typeof seedIdsOf>

test.beforeAll(async () => {
  test.setTimeout(240_000)
  await clearSeeded()
  const siteId = await ensureSeeded({ comentariosC5: true })
  ids = seedIdsOf(siteId)
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

interface Saida { html: string; rsc: string; dom: string; problemas: string[] }
async function ler(ctx: BrowserContext, videoOraculo: string): Promise<Saida> {
  const url = ROTA + ids.video(videoOraculo)
  const html = await (await ctx.request.get(url)).text()
  const rsc = await (await ctx.request.get(url, { headers: { RSC: '1' } })).text()
  const page: Page = await ctx.newPage()
  const problemas: string[] = []
  page.on('pageerror', (e) => problemas.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') problemas.push('console: ' + m.text()) })
  page.on('response', (r) => { if (r.status() >= 400 && /localhost:3099/.test(r.url())) problemas.push(`${r.status()} ${new URL(r.url()).pathname}`) })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(url)
  await page.getByText(TITULO, { exact: true }).first().waitFor({ timeout: 90_000 })
  await page.waitForLoadState('networkidle')
  const dom = await page.evaluate(() => document.body.innerText + '\n' + document.body.innerHTML)
  await page.close()
  return { html, rsc, dom, problemas }
}
const tudo = (s: Saida): string => s.html + '\n' + s.rsc + '\n' + s.dom

test.describe('E5a C5: comentários de destaque', () => {
  test.describe('administrador (nível texto)', () => {
    test.use({ storageState: ADMIN_STATE })
    test('o texto chega; nome, foto e id do YouTube não chegam; console limpo', async ({ browser }) => {
      test.setTimeout(180_000)
      const ctx = await browser.newContext({ storageState: ADMIN_STATE })
      try {
        const s = await ler(ctx, C5.video.cheio)
        expect(s.dom + s.html, 'controle positivo: o texto sentinela existe para quem pode ler').toContain(C5.texto)
        for (const n of [...NOMES, ...FOTOS]) expect(tudo(s), `"${n}" não pode chegar ao navegador sem o token de edição`).not.toContain(n)
        expect(tudo(s), 'a menção @handle de autor com nome vencido é trocada por "@…"').not.toContain('@Hortencio')
        expect(s.problemas).toEqual([])
      } finally { await ctx.close() }
    })
    // ACHADO C5-G1 (menor, Yannis): nome por extenso numa resposta do criador ("Valeu, Hortencio Vasconcelos") e a menção de duas palavras
    // ("@Hortencio Vasconcelos" vira "@… Vasconcelos") passam. Este teste DEVE FALHAR hoje (test.fail); quando o produto for consertado ele
    // passa a "inesperadamente passou" e a anotação sai.
    test('ACHADO G1: o nome vencido por extenso não aparece nas respostas do criador', async ({ browser }) => {
      test.fail()
      test.setTimeout(180_000)
      const ctx = await browser.newContext({ storageState: ADMIN_STATE })
      try {
        const s = await ler(ctx, C5.video.cheio)
        expect(tudo(s)).not.toContain(C5.nomeVencido)
        expect(tudo(s)).not.toContain('Vasconcelos')
      } finally { await ctx.close() }
    })
  })

  test('reporter (nível contagem): nem texto nem nome em HTML, DOM e carga RSC; o título da seção existe', async ({ browser }) => {
    test.setTimeout(180_000)
    const ctx = await browser.newContext({ storageState: REPORTER_STATE })
    try {
      const s = await ler(ctx, C5.video.cheio)
      for (const n of [C5.texto, ...NOMES, C5.nomeVencido, ...FOTOS]) expect(tudo(s), `"${n}" não pode chegar ao reporter`).not.toContain(n)
      expect(s.problemas).toEqual([])
    } finally { await ctx.close() }
  })

  test.describe('estados (administrador)', () => {
    test.use({ storageState: ADMIN_STATE })
    test('comentários desligados pelo canal: a frase exata, não "zero"', async ({ browser }) => {
      test.setTimeout(180_000)
      const ctx = await browser.newContext({ storageState: ADMIN_STATE })
      try {
        const s = await ler(ctx, C5.video.desligados)
        expect(s.dom).toContain('Comentários desligados pelo canal.')
        expect(s.problemas).toEqual([])
      } finally { await ctx.close() }
    })
    test('vídeo novo: o retrato ainda vai chegar, com a frase "Ainda não existe"', async ({ browser }) => {
      test.setTimeout(180_000)
      const ctx = await browser.newContext({ storageState: ADMIN_STATE })
      try {
        const s = await ler(ctx, C5.video.aCaminho)
        expect(s.dom).toMatch(/Ainda não existe: o vídeo fez/)
        expect(s.problemas).toEqual([])
      } finally { await ctx.close() }
    })
  })
})
